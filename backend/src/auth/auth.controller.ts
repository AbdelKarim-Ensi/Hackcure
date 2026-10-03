import { Public } from '../common/decorators/public.decorator';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  LoginDto, OtpSendDto, OtpSendResponseDto, OtpVerifyDto, RefreshDto,
  RegisterDto, RegisterResponseDto, TokensDto,
} from './auth.dto';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Créer un compte',
    description: "Crée le compte (téléphone + mot de passe) et envoie un code OTP. Le compte reste non vérifié jusqu'à /auth/otp/verify.",
  })
  @ApiCreatedResponse({ type: RegisterResponseDto })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renvoyer un code OTP', description: 'Limité en débit (quota strict, T7.3).' })
  @ApiOkResponse({ type: OtpSendResponseDto })
  sendOtp(@Body() dto: OtpSendDto) {
    return this.auth.sendOtp(dto.phone);
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Vérifier le code OTP', description: 'Marque le téléphone comme vérifié et renvoie les tokens JWT.' })
  @ApiOkResponse({ type: TokensDto })
  verifyOtp(@Body() dto: OtpVerifyDto) {
    return this.auth.verifyOtp(dto.phone, dto.code);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connexion par téléphone et mot de passe' })
  @ApiOkResponse({ type: TokensDto })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renouveler les tokens' })
  @ApiOkResponse({ type: TokensDto })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }
}
