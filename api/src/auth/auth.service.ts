import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export type AppUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
};

type LoginRequest = {
  email?: string;
  password?: string;
};

@Injectable()
export class AuthService {
  private readonly demoUsers: Record<string, AppUser & { password: string }> = {
    'approver@example.test': {
      id: 'demo-approver',
      email: 'approver@example.test',
      name: 'Demo Approver',
      role: 'Approver',
      organizationId: 'demo-org',
      password: 'demo123',
    },
    'backup@example.test': {
      id: 'demo-backup-approver',
      email: 'backup@example.test',
      name: 'Demo Backup Approver',
      role: 'Backup Approver',
      organizationId: 'demo-org',
      password: 'demo123',
    },
    'admin@example.test': {
      id: 'demo-admin',
      email: 'admin@example.test',
      name: 'Demo Admin',
      role: 'Admin',
      organizationId: 'demo-org',
      password: 'demo123',
    },
  };

  constructor(private readonly prisma?: PrismaService) {}

  async login(input: LoginRequest) {
    const email = input.email?.trim().toLowerCase();
    const password = input.password ?? '';
    const user = await this.findUserByEmail(email ?? '');

    if (!user || password !== user.password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { password: _password, ...safeUser } = user;
    const token = this.createToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    });

    return {
      token,
      user: safeUser,
    };
  }

  async resolveSession(token: string): Promise<AppUser> {
    const payload = this.decodeToken(token);
    const user = await this.findUserById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Invalid or expired session token');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    };
  }

  getTokenFromHeader(header?: string): string | undefined {
    if (!header) return undefined;
    if (!header.startsWith('Bearer ')) return undefined;
    return header.slice('Bearer '.length).trim();
  }

  assertOrganizationAccess(user: Pick<AppUser, 'organizationId'> | undefined, organizationId?: string): void {
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const normalizedOrganizationId = organizationId?.trim();
    if (!normalizedOrganizationId) {
      throw new BadRequestException('organizationId is required');
    }

    if (user.organizationId !== normalizedOrganizationId) {
      throw new ForbiddenException('You do not have access to this organization');
    }
  }

  private async findUserByEmail(email: string): Promise<(AppUser & { password: string }) | undefined> {
    const demoUser = this.demoUsers[email];
    if (demoUser) return demoUser;

    if (!this.prisma) return undefined;

    const contact = await this.prisma.contact.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      include: { organization: true },
    });

    if (!contact) return undefined;

    return {
      id: contact.id,
      email: contact.email,
      name: contact.name,
      role: contact.role,
      organizationId: contact.organizationId,
      password: 'demo123',
    };
  }

  private async findUserById(userId: string): Promise<(AppUser & { password: string }) | undefined> {
    const demoUser = Object.values(this.demoUsers).find((user) => user.id === userId);
    if (demoUser) return demoUser;

    if (!this.prisma) return undefined;

    const contact = await this.prisma.contact.findUnique({
      where: { id: userId },
      include: { organization: true },
    });

    if (!contact) return undefined;

    return {
      id: contact.id,
      email: contact.email,
      name: contact.name,
      role: contact.role,
      organizationId: contact.organizationId,
      password: 'demo123',
    };
  }

  private createToken(payload: Record<string, string>) {
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  private decodeToken(token: string): Record<string, string> {
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const parsed = JSON.parse(decoded) as Record<string, string>;

      if (!parsed.sub || !parsed.email) {
        throw new UnauthorizedException('Invalid or expired session token');
      }

      return parsed;
    } catch {
      throw new UnauthorizedException('Invalid or expired session token');
    }
  }
}
