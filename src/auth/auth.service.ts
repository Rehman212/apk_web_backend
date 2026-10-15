import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (user.role !== 'ADMIN') {
      throw new UnauthorizedException('Admin access only.');
    }

    return this.issue(user.id, user.name, user.email, user.role);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    if (!user || user.role !== 'ADMIN') {
      throw new UnauthorizedException('Admin access only.');
    }
    return user;
  }

  async overview() {
    const [admins, users] = await Promise.all([
      this.prisma.user.count({ where: { role: 'ADMIN' } }),
      this.prisma.user.count(),
    ]);
    return { admins, users };
  }

  private issue(id: string, name: string, email: string, role: string) {
    const token = this.jwt.sign({ sub: id, email, role });
    return {
      token,
      user: { id, name, email, role },
    };
  }
}
