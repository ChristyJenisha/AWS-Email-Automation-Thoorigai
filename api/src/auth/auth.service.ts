import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
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
      password: bcrypt.hashSync('demo123', 10),
    },
    'backup@example.test': {
      id: 'demo-backup-approver',
      email: 'backup@example.test',
      name: 'Demo Backup Approver',
      role: 'Backup Approver',
      organizationId: 'demo-org',
      password: bcrypt.hashSync('demo123', 10),
    },
    'admin@example.test': {
      id: 'demo-admin',
      email: 'admin@example.test',
      name: 'Demo Admin',
      role: 'Admin',
      organizationId: 'demo-org',
      password: bcrypt.hashSync('demo123', 10),
    },
  };

  constructor(private readonly prisma?: PrismaService) {}

  async login(input: LoginRequest) {
    const email = input.email?.trim().toLowerCase();
    const password = input.password ?? '';
    const user = await this.findUserByEmail(email ?? '');

    if (!user || !(await bcrypt.compare(password, user.password))) {
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

  assertAdminAccess(user: Pick<AppUser, 'role'> | undefined): void {
    if (!user) throw new UnauthorizedException('Authentication required');
    const role = String(user.role).trim().toUpperCase();
    if (role !== 'ADMIN') {
      throw new ForbiddenException('Administrator access is required');
    }
  }

  isDemoEnabled(): boolean {
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    return process.env.DEMO_MODE !== 'false';
  }

  getBootstrapAdminConfig(): { email: string; passwordHash: string; name: string } | undefined {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    const passwordHash = process.env.ADMIN_PASSWORD_HASH;

    if (!email || (!password && !passwordHash)) {
      return undefined;
    }

    return {
      email,
      name: process.env.ADMIN_NAME?.trim() || 'Administrator',
      passwordHash: passwordHash || bcrypt.hashSync(password!, 10),
    };
  }

  private async findUserByEmail(email: string): Promise<(AppUser & { password: string }) | undefined> {
    // 1. Production bootstrap admin via environment credentials
    const bootstrapAdmin = this.getBootstrapAdminConfig();
    if (bootstrapAdmin && email.toLowerCase() === bootstrapAdmin.email) {
      let orgId = process.env.ADMIN_ORG_ID?.trim() || 'demo-org';
      let userId = 'bootstrap-admin';
      let name = bootstrapAdmin.name;

      if (this.prisma) {
        try {
          let contact = await this.prisma.contact.findFirst({
            where: { email: { equals: bootstrapAdmin.email, mode: 'insensitive' } },
            include: { organization: true },
          });

          if (!contact) {
            let org = await this.prisma.organization.findFirst();
            if (!org) {
              org = await this.prisma.organization.create({
                data: {
                  id: orgId,
                  name: 'Primary Organization',
                },
              });
            }
            contact = await this.prisma.contact.create({
              data: {
                organizationId: org.id,
                name: bootstrapAdmin.name,
                email: bootstrapAdmin.email,
                role: Role.ADMIN,
                isActive: true,
              },
              include: { organization: true },
            });
          }

          userId = contact.id;
          orgId = contact.organizationId;
          name = contact.name;
        } catch {
          // If database is not ready or throws, fallback to bootstrap IDs
        }
      }

      return {
        id: userId,
        email: bootstrapAdmin.email,
        name,
        role: 'Admin',
        organizationId: orgId,
        password: bootstrapAdmin.passwordHash,
      };
    }

    // 2. Demo users lookup (only when demo mode is active)
    if (this.isDemoEnabled()) {
      const demoUser = this.demoUsers[email];
      if (demoUser) return demoUser;
    }

    if (!this.prisma) return undefined;

    const contact = await this.prisma.contact.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      include: { organization: true },
    });

    if (!contact || !contact.isActive) return undefined;

    // 1. If contact has an individual assigned password hash, use it
    if (contact.passwordHash) {
      return {
        id: contact.id,
        email: contact.email,
        name: contact.name,
        role: contact.role,
        organizationId: contact.organizationId,
        password: contact.passwordHash,
      };
    }

    // 2. In demo mode only, fallback to demo123 for seeded/legacy demo contacts
    if (this.isDemoEnabled()) {
      return {
        id: contact.id,
        email: contact.email,
        name: contact.name,
        role: contact.role,
        organizationId: contact.organizationId,
        password: bcrypt.hashSync('demo123', 10),
      };
    }

    return undefined;
  }

  private async findUserById(userId: string): Promise<(AppUser & { password: string }) | undefined> {
    const bootstrapAdmin = this.getBootstrapAdminConfig();
    if (bootstrapAdmin && userId === 'bootstrap-admin') {
      return {
        id: 'bootstrap-admin',
        email: bootstrapAdmin.email,
        name: bootstrapAdmin.name,
        role: 'Admin',
        organizationId: process.env.ADMIN_ORG_ID?.trim() || 'demo-org',
        password: bootstrapAdmin.passwordHash,
      };
    }

    if (this.isDemoEnabled()) {
      const demoUser = Object.values(this.demoUsers).find((user) => user.id === userId);
      if (demoUser) return demoUser;
    }

    if (!this.prisma) return undefined;

    const contact = await this.prisma.contact.findUnique({
      where: { id: userId },
      include: { organization: true },
    });

    if (!contact || !contact.isActive) return undefined;

    return {
      id: contact.id,
      email: contact.email,
      name: contact.name,
      role: contact.role,
      organizationId: contact.organizationId,
      password: '',
    };
  }

  private createToken(payload: Record<string, string>) {
    return jwt.sign(payload, this.getJwtSecret(), { expiresIn: '30d' });
  }

  private decodeToken(token: string): Record<string, string> {
    try {
      const parsed = jwt.verify(token, this.getJwtSecret()) as Record<string, string>;

      if (!parsed.sub || !parsed.email) {
        throw new UnauthorizedException('Invalid or expired session token');
      }

      return parsed;
    } catch {
      throw new UnauthorizedException('Invalid or expired session token');
    }
  }

  private getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      if (process.env.NODE_ENV === 'test') {
        return 'test-jwt-secret-at-least-32-characters-long';
      }
      throw new Error('JWT_SECRET must be set to at least 32 characters');
    }
    return secret;
  }
}
