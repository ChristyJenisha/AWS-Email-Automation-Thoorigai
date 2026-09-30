import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class WorkflowStageInputDto {
  @IsString()
  @IsNotEmpty()
  contactId!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  backupContactId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  reminderIntervalHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  maxReminders?: number;
}

export class CreateWorkflowDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkflowStageInputDto)
  stages!: WorkflowStageInputDto[];
}

export class ReplaceWorkflowDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkflowStageInputDto)
  stages!: WorkflowStageInputDto[];
}

export class WorkflowContactInputDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  role!: string;
}

export class WorkflowActionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  actor?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}