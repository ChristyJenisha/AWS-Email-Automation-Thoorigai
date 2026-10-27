import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PaymentAllocationInputDto } from './payment.dto.js';

export const paymentDetails = {
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

export const toCents = (amount: number) => Math.round(amount * 100);

export const toDecimal = (cents: number) =>
  new Prisma.Decimal((cents / 100).toFixed(2));

export function assertValidDeductions(
  allocations: PaymentAllocationInputDto[],
) {
  const hasInvalidDeduction = allocations.some((allocation) => {
    const deductionCents = toCents(allocation.deductionAmount ?? 0);
    return (deductionCents > 0) !== Boolean(allocation.deductionType);
  });

  if (hasInvalidDeduction) {
    throw new BadRequestException(
      'A deduction type is required when a deduction amount is provided',
    );
  }
}
