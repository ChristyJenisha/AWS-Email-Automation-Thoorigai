
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { BatchStatus, BillStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { S3StorageService } from '../s3/s3-storage.service.js';
import {
  CreatePaymentDto,
  PaymentAllocationInputDto,
} from './payment.dto.js';
import {
  paymentDetails,
  toCents,
  toDecimal,
  assertValidDeductions,
} from './payments.utils.js';
import { PaymentsProofService } from './payments-proof.service.js';

@Injectable()
export class PaymentsService {
  private readonly proofService: PaymentsProofService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3StorageService: S3StorageService,
    @Optional() proofService?: PaymentsProofService,
  ) {
    this.proofService = proofService ?? new PaymentsProofService(this.prisma, this.s3StorageService);
  }

  async getBatch(batchId: string) {
    const batch = await this.prisma.batch.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        organizationId: true,
      },
    });

    if (!batch) {
      throw new NotFoundException('Batch not found');
    }

    return batch;
  }

  async getPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        batch: {
          select: {
            id: true,
            organizationId: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async listByBatch(batchId: string) {
    return this.prisma.payment.findMany({
      where: { batchId },
      include: paymentDetails,
      orderBy: { paidAt: 'desc' },
    });
  }

  async create(input: CreatePaymentDto, actor: string) {
    const idempotencyKey = input.idempotencyKey?.trim() || undefined;
    if (idempotencyKey) {
      const existing = await this.prisma.payment.findUnique({
        where: { idempotencyKey },
        include: paymentDetails,
      });
      if (existing) {
        return existing;
      }
    }
    const allocations = input.allocations ?? [];

    const billIds = allocations.map(
      (allocation) => allocation.billId,
    );

    if (new Set(billIds).size !== billIds.length) {
      throw new BadRequestException(
        'Each bill can only appear once in a payment',
      );
    }

    const paymentCents = toCents(input.amount);

    const settledCents = allocations.reduce(
      (total, allocation) =>
        total +
        toCents(allocation.amount) +
        toCents(allocation.deductionAmount ?? 0),
      0,
    );

    if (settledCents > paymentCents) {
      throw new BadRequestException(
        'Allocated cash plus deductions cannot exceed the payment amount',
      );
    }

    const hasInvalidDeduction = allocations.some(
      (allocation) => {
        const deductionCents = toCents(
          allocation.deductionAmount ?? 0,
        );

        return (
          (deductionCents > 0) !==
          Boolean(allocation.deductionType)
        );
      },
    );

    if (hasInvalidDeduction) {
      throw new BadRequestException(
        'A deduction type is required when a deduction amount is provided',
      );
    }

    try {
      return await this.prisma.$transaction(
      async (transaction) => {
        const batch = await transaction.batch.findUnique({
          where: { id: input.batchId },
          include: { bills: true },
        });

        if (!batch) {
          throw new NotFoundException('Batch not found');
        }

        if (
          batch.status !==
          BatchStatus.READY_FOR_PAYMENT
        ) {
          throw new ConflictException(
            'Payments can only be recorded after all approval stages are complete',
          );
        }

        const billsById = new Map<
          string,
          (typeof batch.bills)[number]
        >(
          batch.bills.map((bill) => [
            bill.id,
            bill,
          ]),
        );

        for (const allocation of allocations) {
          const bill = billsById.get(
            allocation.billId,
          );

          if (!bill) {
            throw new BadRequestException(
              'Every allocated bill must belong to the selected batch',
            );
          }

          const amountCents = toCents(
            allocation.amount,
          );

          const deductionCents = toCents(
            allocation.deductionAmount ?? 0,
          );

          if (
            amountCents + deductionCents >
            toCents(Number(bill.balanceDue))
          ) {
            throw new BadRequestException(
              `Allocation exceeds the balance due for bill ${bill.billNumber}`,
            );
          }
        }

        const payment =
          await transaction.payment.create({
            data: {
              batchId: batch.id,
              amount: toDecimal(paymentCents),
              unallocatedAmount: toDecimal(
                paymentCents - settledCents,
              ),
              paidAt: input.paidAt
                ? new Date(input.paidAt)
                : undefined,
              reference:
                input.reference?.trim() ||
                undefined,
              idempotencyKey,
              allocations: {
                create: allocations.map(
                  (allocation) => ({
                    billId: allocation.billId,
                    amount: toDecimal(
                      toCents(
                        allocation.amount,
                      ),
                    ),
                    deductionAmount: toDecimal(
                      toCents(
                        allocation.deductionAmount ??
                          0,
                      ),
                    ),
                    deductionType:
                      allocation.deductionType,
                  }),
                ),
              },
            },
            include: paymentDetails,
          });

        for (const allocation of allocations) {
          const bill = billsById.get(
            allocation.billId,
          )!;

          const remainingCents =
            toCents(Number(bill.balanceDue)) -
            toCents(allocation.amount) -
            toCents(
              allocation.deductionAmount ?? 0,
            );

          const updated =
            await transaction.bill.updateMany({
              where: {
                id: bill.id,
                batchId: batch.id,
                balanceDue: {
                  gte: toDecimal(
                    toCents(
                      allocation.amount,
                    ) +
                      toCents(
                        allocation.deductionAmount ??
                          0,
                      ),
                  ),
                },
              },
              data: {
                balanceDue: {
                  decrement: toDecimal(
                    toCents(
                      allocation.amount,
                    ) +
                      toCents(
                        allocation.deductionAmount ??
                          0,
                      ),
                  ),
                },
                status:
                  remainingCents === 0
                    ? BillStatus.PAID
                    : BillStatus.PARTIALLY_PAID,
              },
            });

          if (updated.count !== 1) {
            throw new ConflictException(
              `The balance for bill ${bill.billNumber} changed; reload and retry`,
            );
          }
        }

        const remainingBills =
          await transaction.bill.count({
            where: {
              batchId: batch.id,
              status: {
                not: BillStatus.PAID,
              },
            },
          });

        if (
          remainingBills === 0 &&
          paymentCents === settledCents
        ) {
          const completed =
            await transaction.batch.updateMany(
              {
                where: {
                  id: batch.id,
                  status:
                    BatchStatus.READY_FOR_PAYMENT,
                },
                data: {
                  status:
                    BatchStatus.COMPLETED,
                },
              },
            );

          if (completed.count !== 1) {
            throw new ConflictException(
              'The batch status changed while recording payment',
            );
          }
        }

        await transaction.auditLog.create({
          data: {
            entityType: 'payment',
            entityId: payment.id,
            action: 'recorded',
            actor,
            detail: {
              batchId: batch.id,
              amount: input.amount,
              allocationCount:
                allocations.length,
              unallocatedAmount:
                (paymentCents -
                  settledCents) /
                100,
            },
          },
        });

        return payment;
      },
    );
    } catch (error: any) {
      if (idempotencyKey && (error?.code === 'P2002' || error?.message?.includes('idempotency_key'))) {
        const existing = await this.prisma.payment.findUnique({
          where: { idempotencyKey },
          include: paymentDetails,
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  // --------------------------------------------------
  // PAYMENT PROOF DELEGATION (P3-5 Modularization)
  // --------------------------------------------------

  async createProofUploadUrl(paymentId: string, contentType: string) {
    return this.proofService.createProofUploadUrl(paymentId, contentType);
  }

  async confirmProofUpload(paymentId: string, key: string) {
    return this.proofService.confirmProofUpload(paymentId, key);
  }

  async storeProofFile(paymentId: string, contentType: string, content: Buffer) {
    return this.proofService.storeProofFile(paymentId, contentType, content);
  }

  async createProofDownloadUrl(paymentId: string) {
    return this.proofService.createProofDownloadUrl(paymentId);
  }

  async getLocalProofFile(paymentId: string) {
    return this.proofService.getLocalProofFile(paymentId);
  }

  async allocateOnAccount(
    paymentId: string,
    allocations: PaymentAllocationInputDto[],
    actor: string,
  ) {
    const billIds = allocations.map(
      (allocation) => allocation.billId,
    );

    if (new Set(billIds).size !== billIds.length) {
      throw new BadRequestException(
        'Each bill can only appear once in an allocation request',
      );
    }

    assertValidDeductions(allocations);

    return this.prisma.$transaction(
      async (transaction) => {
        const payment =
          await transaction.payment.findUnique({
            where: { id: paymentId },
            include: {
              batch: {
                include: {
                  bills: true,
                },
              },
              allocations: {
                select: {
                  billId: true,
                },
              },
            },
          });

        if (!payment) {
          throw new NotFoundException(
            'Payment not found',
          );
        }

        if (
          payment.batch.status !==
          BatchStatus.READY_FOR_PAYMENT
        ) {
          throw new ConflictException(
            'On-account funds can only be allocated while the batch is ready for payment',
          );
        }

        const alreadyAllocatedBillIds =
          new Set(
            payment.allocations.map(
              (allocation) =>
                allocation.billId,
            ),
          );

        if (
          billIds.some((billId) =>
            alreadyAllocatedBillIds.has(
              billId,
            ),
          )
        ) {
          throw new ConflictException(
            'This payment already contains an allocation for one of these bills',
          );
        }

        const allocatedCents =
          allocations.reduce(
            (total, allocation) =>
              total +
              toCents(
                allocation.amount,
              ) +
              toCents(
                allocation.deductionAmount ??
                  0,
              ),
            0,
          );

        const unallocatedCents =
          toCents(
            Number(
              payment.unallocatedAmount,
            ),
          );

        if (
          allocatedCents <= 0 ||
          allocatedCents >
            unallocatedCents
        ) {
          throw new BadRequestException(
            'Allocation must be positive and cannot exceed the on-account balance',
          );
        }

        const billsById = new Map(
          payment.batch.bills.map(
            (bill) => [bill.id, bill],
          ),
        );

        for (const allocation of allocations) {
          const bill = billsById.get(
            allocation.billId,
          );

          if (!bill) {
            throw new BadRequestException(
              'Every allocated bill must belong to the payment batch',
            );
          }

          const settlementCents =
            toCents(
              allocation.amount,
            ) +
            toCents(
              allocation.deductionAmount ??
                0,
            );

          if (
            settlementCents >
            toCents(
              Number(
                bill.balanceDue,
              ),
            )
          ) {
            throw new BadRequestException(
              `Allocation exceeds the balance due for bill ${bill.billNumber}`,
            );
          }
        }

        await transaction.paymentAllocation.createMany(
          {
            data: allocations.map(
              (allocation) => ({
                paymentId,
                billId:
                  allocation.billId,
                amount: toDecimal(
                  toCents(
                    allocation.amount,
                  ),
                ),
                deductionAmount:
                  toDecimal(
                    toCents(
                      allocation.deductionAmount ??
                        0,
                    ),
                  ),
                deductionType:
                  allocation.deductionType,
              }),
            ),
          },
        );

        for (const allocation of allocations) {
          const bill = billsById.get(
            allocation.billId,
          )!;

          const settlementCents =
            toCents(
              allocation.amount,
            ) +
            toCents(
              allocation.deductionAmount ??
                0,
            );

          const remainingCents =
            toCents(
              Number(
                bill.balanceDue,
              ),
            ) -
            settlementCents;

          const updated =
            await transaction.bill.updateMany({
              where: {
                id: bill.id,
                batchId:
                  payment.batchId,
                balanceDue: {
                  gte: toDecimal(
                    settlementCents,
                  ),
                },
              },
              data: {
                balanceDue: {
                  decrement:
                    toDecimal(
                      settlementCents,
                    ),
                },
                status:
                  remainingCents === 0
                    ? BillStatus.PAID
                    : BillStatus.PARTIALLY_PAID,
              },
            });

          if (updated.count !== 1) {
            throw new ConflictException(
              `The balance for bill ${bill.billNumber} changed; reload and retry`,
            );
          }
        }

        const remainingUnallocatedCents =
          unallocatedCents -
          allocatedCents;

        const updatedPayment =
          await transaction.payment.update({
            where: { id: paymentId },
            data: {
              unallocatedAmount:
                toDecimal(
                  remainingUnallocatedCents,
                ),
            },
            include: paymentDetails,
          });

        const remainingBills =
          await transaction.bill.count({
            where: {
              batchId:
                payment.batchId,
              status: {
                not: BillStatus.PAID,
              },
            },
          });

        if (
          remainingBills === 0 &&
          remainingUnallocatedCents === 0
        ) {
          const completed =
            await transaction.batch.updateMany(
              {
                where: {
                  id: payment.batchId,
                  status:
                    BatchStatus.READY_FOR_PAYMENT,
                },
                data: {
                  status:
                    BatchStatus.COMPLETED,
                },
              },
            );

          if (completed.count !== 1) {
            throw new ConflictException(
              'The batch status changed while allocating on-account funds',
            );
          }
        }

        await transaction.auditLog.create({
          data: {
            entityType: 'payment',
            entityId: paymentId,
            action: 'on_account_allocated',
            actor,
            detail: {
              batchId:
                payment.batchId,
              allocationCount:
                allocations.length,
              remainingUnallocated:
                remainingUnallocatedCents /
                100,
            },
          },
        });

        return updatedPayment;
      },
    );
  }
}



