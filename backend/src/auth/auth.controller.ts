// AJOUT : T7.3
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import {
  LoginDto,
  OtpSendDto,
  OtpSendResponseDto,
  OtpVerifyDto,
  RefreshDto,
  RegisterDto,
  RegisterResponseDto,
  TokensDto,
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
    description:
      "Crée le compte (téléphone + mot de passe) et envoie un code OTP. Le compte reste non vérifié jusqu'à /auth/otp/verify.",
  })
  @ApiCreatedResponse({ type: RegisterResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Données invalides ou téléphone déjà utilisé',
  })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  // AJOUT : T7.3 quota strict OTP
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Renvoyer un code OTP',
    description: 'Limité en débit (quota strict, T7.3).',
  })
  @ApiOkResponse({ type: OtpSendResponseDto })
  sendOtp(@Body() dto: OtpSendDto) {
    return this.auth.sendOtp(dto.phone);
  }

  // AJOUT : T7.3 quota strict OTP
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Vérifier le code OTP',
    description: 'Marque le téléphone comme vérifié et renvoie les tokens JWT.',
  })
  @ApiOkResponse({ type: TokensDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: "Code incorrect, expiré ou trop d'essais",
  })
  verifyOtp(@Body() dto: OtpVerifyDto) {
    return this.auth.verifyOtp(dto.phone, dto.code);
  }

  // AJOUT : T7.3 quota strict login
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connexion par téléphone et mot de passe' })
  @ApiOkResponse({ type: TokensDto })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Identifiants invalides',
  })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renouveler les tokens' })
  @ApiOkResponse({ type: TokensDto })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Refresh token invalide ou expiré',
  })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }
}
