import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

function normalizeRole(value: unknown): Role {
  if (typeof value !== 'string') return Role.APPROVER;
  const upper = value.trim().toUpperCase().replace(/[\s_-]+/g, '_');
  if (upper === 'ADMIN') return Role.ADMIN;
  if (upper.includes('BACKUP')) return Role.BACKUP_APPROVER;
  return Role.APPROVER;
}

export class CreateContactDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsEmail()
  email!: string;

  @Transform(({ value }) => normalizeRole(value))
  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @MaxLength(128)
  password?: string;
}

export class UpdateContactDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeRole(value))
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @MaxLength(128)
  password?: string;
}
