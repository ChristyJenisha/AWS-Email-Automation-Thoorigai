import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { DeductionType } from '@prisma/client';

export class PaymentAllocationInputDto {
  @IsString()
  @IsNotEmpty()
  billId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  deductionAmount?: number;

  @IsOptional()
  @IsEnum(DeductionType)
  deductionType?: DeductionType;
}

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty()
  batchId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaymentAllocationInputDto)
  allocations?: PaymentAllocationInputDto[];
}

export class AllocateOnAccountPaymentDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaymentAllocationInputDto)
  allocations!: PaymentAllocationInputDto[];
}

export class CreatePaymentProofUploadUrlDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  contentType!: string;
}

export class ConfirmPaymentProofDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  key!: string;
}
