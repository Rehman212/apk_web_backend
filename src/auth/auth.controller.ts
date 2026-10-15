import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/auth.dto';
import { JwtAuthGuard } from './jwt.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: { user: { sub: string } }) {
    return this.auth.me(req.user.sub);
  }

  @Get('overview')
  @UseGuards(JwtAuthGuard)
  overview() {
    return this.auth.overview();
  }
}
