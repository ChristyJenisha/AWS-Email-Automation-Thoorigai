import { Body, Controller, Get, Param, Post, Query, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthService } from '../auth/auth.service.js';
import type { AuthedRequest } from '../auth/authed-request.interface.js';
import { SubmitIndividualBillDto } from './bills.dto.js';
import { BillsService } from './bills.service.js';

@Controller('bills')
@UseGuards(AuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class BillsController {
  constructor(
    private readonly billsService: BillsService,
    private readonly authService: AuthService,
  ) {}

  @Post('submit')
  async submit(@Req() request: AuthedRequest, @Body() input: SubmitIndividualBillDto) {
    this.authService.assertAdminAccess(request?.user);
    this.authService.assertOrganizationAccess(request?.user, input.organizationId);
    return this.billsService.submitIndividualBill(input);
  }

  @Post()
  async createSingleBill(@Req() request: AuthedRequest, @Body() input: SubmitIndividualBillDto) {
    this.authService.assertAdminAccess(request?.user);
    this.authService.assertOrganizationAccess(request?.user, input.organizationId);
    return this.billsService.submitIndividualBill(input);
  }

  @Get()
  async list(@Req() request: AuthedRequest, @Query('organizationId') organizationId?: string) {
    this.authService.assertOrganizationAccess(request?.user, organizationId);
    return this.billsService.list(organizationId);
  }

  @Get(':id')
  async get(@Req() request: AuthedRequest, @Param('id') id: string) {
    const bill = await this.billsService.get(id);
    this.authService.assertOrganizationAccess(request?.user, bill.batch.organizationId);
    return bill;
  }
}
