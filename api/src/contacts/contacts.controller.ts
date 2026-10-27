import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthService } from '../auth/auth.service.js';
import type { AuthedRequest } from '../auth/authed-request.interface.js';
import { CreateContactDto, UpdateContactDto } from './contact.dto.js';
import { ContactsService } from './contacts.service.js';

@Controller('contacts')
@UseGuards(AuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class ContactsController {
  constructor(
    private readonly contactsService: ContactsService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  list(@Req() request: AuthedRequest, @Query('organizationId') organizationId?: string) {
    this.authService.assertOrganizationAccess(request?.user, organizationId);
    this.authService.assertAdminAccess(request?.user);
    return this.contactsService.listByOrganization(organizationId!);
  }

  @Post()
  create(@Req() request: AuthedRequest, @Body() input: CreateContactDto) {
    this.authService.assertOrganizationAccess(request?.user, input.organizationId);
    this.authService.assertAdminAccess(request?.user);
    return this.contactsService.create(input);
  }

  @Patch(':id')
  update(@Req() request: AuthedRequest, @Param('id') id: string, @Body() input: UpdateContactDto, @Query('organizationId') organizationId?: string) {
    this.authService.assertOrganizationAccess(request?.user, organizationId);
    this.authService.assertAdminAccess(request?.user);
    return this.contactsService.update(id, organizationId!, input);
  }

  @Delete(':id')
  delete(@Req() request: AuthedRequest, @Param('id') id: string, @Query('organizationId') organizationId?: string) {
    this.authService.assertOrganizationAccess(request?.user, organizationId);
    this.authService.assertAdminAccess(request?.user);
    return this.contactsService.delete(id, organizationId!);
  }
}
