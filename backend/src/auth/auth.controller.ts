// AJOUT : T3 - squelette du contrôleur auth (données mockées, services réels en T2)
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole } from '../common/enums';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { MOCK_IDS } from '../contract/mocks';
import {
  LoginDto,
  OtpSendDto,
  OtpSendResponseDto,
  OtpVerifyDto,
  RefreshDto,
  RegisterDto,
  RegisterResponseDto,
  TokensDto,
} from './dto/auth.dto';

const mockTokens = (phone: string, role: UserRole = UserRole.DONNEUR): TokensDto => ({
  accessToken: 'mock.access.token',
  refreshToken: 'mock.refresh.token',
  expiresIn: 900,
  user: { id: MOCK_IDS.donorUser, role, phone, fullName: 'Amine Ben Salah' },
});

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  @Post('register')
  @ApiOperation({
    summary: 'Créer un compte',
    description: 'Crée le compte (téléphone + mot de passe) et envoie un code OTP. Le compte reste non vérifié jusqu\'à /auth/otp/verify.',
  })
  @ApiCreatedResponse({ type: RegisterResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Données invalides ou téléphone déjà utilisé' })
  register(@Body() _dto: RegisterDto): RegisterResponseDto {
    return { userId: MOCK_IDS.donorUser, otpSent: true, devOtp: '123456' };
  }

  @Post('otp/send')
  @HttpCode(200)
  @ApiOperation({ summary: 'Renvoyer un code OTP', description: 'Limité en débit (quota strict, T7.3).' })
  @ApiOkResponse({ type: OtpSendResponseDto })
  sendOtp(@Body() _dto: OtpSendDto): OtpSendResponseDto {
    return { sent: true, expiresInSeconds: 300, devOtp: '123456' };
  }

  @Post('otp/verify')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Vérifier le code OTP',
    description: 'Marque le téléphone comme vérifié et renvoie les tokens JWT.',
  })
  @ApiOkResponse({ type: TokensDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Code incorrect, expiré ou trop d\'essais' })
  verifyOtp(@Body() dto: OtpVerifyDto): TokensDto {
    return mockTokens(dto.phone);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Connexion par téléphone et mot de passe' })
  @ApiOkResponse({ type: TokensDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Identifiants invalides' })
  login(@Body() dto: LoginDto): TokensDto {
    return mockTokens(dto.phone);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Renouveler les tokens' })
  @ApiOkResponse({ type: TokensDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Refresh token invalide ou expiré' })
  refresh(@Body() _dto: RefreshDto): TokensDto {
    return mockTokens('+21612345678');
  }
}
