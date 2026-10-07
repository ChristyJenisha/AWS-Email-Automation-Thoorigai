import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthService } from '../auth/auth.service.js';
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
  list(@Req() request: any, @Query('organizationId') organizationId?: string) {
    this.authService.assertOrganizationAccess(request?.user, organizationId);
    this.authService.assertAdminAccess(request?.user);
    return this.contactsService.listByOrganization(organizationId!);
  }

  @Post()
  create(@Req() request: any, @Body() input: CreateContactDto) {
    this.authService.assertOrganizationAccess(request?.user, input.organizationId);
    this.authService.assertAdminAccess(request?.user);
    return this.contactsService.create(input);
  }

  @Patch(':id')
  update(@Req() request: any, @Param('id') id: string, @Body() input: UpdateContactDto, @Query('organizationId') organizationId?: string) {
    this.authService.assertOrganizationAccess(request?.user, organizationId);
    this.authService.assertAdminAccess(request?.user);
    return this.contactsService.update(id, organizationId!, input);
  }
}