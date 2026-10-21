import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BatchesService } from '../batches/batches.service.js';
import { SubmitIndividualBillDto } from './bills.dto.js';

@Injectable()
export class BillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly batchesService: BatchesService,
  ) {}

  async submitIndividualBill(input: SubmitIndividualBillDto) {
    if (!input.billNumber?.trim()) {
      throw new BadRequestException('Bill number is required');
    }
    if (!input.amount || input.amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    // Reuse robust batch workflow pipeline engine for single bill
    const batch = await this.batchesService.create({
      organizationId: input.organizationId,
      templateId: input.templateId,
      bills: [
        {
          billNumber: input.billNumber.trim(),
          amount: input.amount,
          dueDate: input.dueDate,
        },
      ],
    });

    return {
      message: 'Individual bill submitted for approval successfully',
      batchId: batch.id,
      bill: batch.bills[0],
      stepInstances: batch.stepInstances,
      organization: batch.organization,
      template: batch.template,
    };
  }

  async list(organizationId?: string) {
    if (!organizationId?.trim()) {
      throw new BadRequestException('organizationId is required');
    }

    return this.prisma.bill.findMany({
      where: {
        batch: { organizationId },
      },
      include: {
        batch: {
          select: {
            id: true,
            status: true,
            template: { select: { id: true, name: true } },
            stepInstances: {
              orderBy: { stage: { order: 'asc' } },
              include: {
                stage: {
                  include: {
                    contact: { select: { id: true, name: true, email: true, role: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const bill = await this.prisma.bill.findUnique({
      where: { id },
      include: {
        batch: {
          include: {
            organization: { select: { id: true, name: true } },
            template: { select: { id: true, name: true } },
            stepInstances: {
              orderBy: { stage: { order: 'asc' } },
              include: {
                stage: {
                  include: {
                    contact: { select: { id: true, name: true, email: true, role: true } },
                  },
                },
              },
            },
          },
        },
        allocations: {
          include: {
            payment: true,
          },
        },
      },
    });

    if (!bill) throw new NotFoundException('Bill not found');
    return bill;
  }
}

