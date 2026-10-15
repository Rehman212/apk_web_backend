import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const header = String(req.headers.authorization || "");
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) {
      throw new UnauthorizedException("Sign in required.");
    }
    try {
      req.user = this.jwt.verify(token);
      return true;
    } catch {
      throw new UnauthorizedException("Session expired. Sign in again.");
    }
  }
}
