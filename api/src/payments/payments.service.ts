
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BatchStatus, BillStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { S3StorageService } from '../s3/s3-storage.service.js';
import {
  CreatePaymentDto,
  PaymentAllocationInputDto,
} from './payment.dto.js';

const paymentDetails = {
  allocations: {
    include: {
      bill: {
        select: {
          id: true,
          billNumber: true,
          amount: true,
          balanceDue: true,
          status: true,
        },
      },
    },
  },
} satisfies Prisma.PaymentInclude;

const toCents = (amount: number) => Math.round(amount * 100);

const toDecimal = (cents: number) =>
  new Prisma.Decimal((cents / 100).toFixed(2));

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3StorageService: S3StorageService,
  ) {}

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

    return this.prisma.$transaction(
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
  }

  // --------------------------------------------------
  // PAYMENT PROOF - S3 PRESIGNED UPLOAD URL
  // --------------------------------------------------

  async createProofUploadUrl(
    paymentId: string,
    contentType: string,
  ) {
    const payment =
      await this.prisma.payment.findUnique({
        where: { id: paymentId },
        select: {
          id: true,
        },
      });

    if (!payment) {
      throw new NotFoundException(
        'Payment not found',
      );
    }

    const upload =
      await this.s3StorageService.createPaymentProofUploadUrl(
        paymentId,
        contentType,
      );

    return upload;
  }

  async confirmProofUpload(paymentId: string, key: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (!key.startsWith(`payment-proofs/${paymentId}/`)) {
      throw new BadRequestException('Proof file does not belong to this payment');
    }

    await this.s3StorageService.confirmUploadedObject(key);
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { proofKey: key },
      select: { id: true, proofKey: true },
    });
  }

  async storeProofFile(paymentId: string, contentType: string, content: Buffer) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const stored = await this.s3StorageService.storePaymentProof(paymentId, contentType, content);
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { proofKey: stored.key },
      select: { id: true, proofKey: true },
    });
  }

  async createProofDownloadUrl(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, proofKey: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (!payment.proofKey) {
      throw new NotFoundException('Payment proof not found');
    }

    if (payment.proofKey.startsWith(`local-payment-proofs/${paymentId}/`)) {
      return { local: true as const };
    }
    if (!payment.proofKey.startsWith(`payment-proofs/${paymentId}/`)) {
      throw new NotFoundException('Payment proof not found');
    }

    return this.s3StorageService.createDownloadUrl(payment.proofKey);
  }

  async getLocalProofFile(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { proofKey: true },
    });
    if (!payment?.proofKey?.startsWith(`local-payment-proofs/${paymentId}/`)) {
      throw new NotFoundException('Local payment proof not found');
    }
    return this.s3StorageService.readLocalPaymentProof(paymentId, payment.proofKey);
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

    this.assertValidDeductions(allocations);

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

  private assertValidDeductions(
    allocations: PaymentAllocationInputDto[],
  ) {
    const hasInvalidDeduction =
      allocations.some(
        (allocation) => {
          const deductionCents =
            toCents(
              allocation.deductionAmount ??
                0,
            );

          return (
            (deductionCents > 0) !==
            Boolean(
              allocation.deductionType,
            )
          );
        },
      );

    if (hasInvalidDeduction) {
      throw new BadRequestException(
        'A deduction type is required when a deduction amount is provided',
      );
    }
  }
}


