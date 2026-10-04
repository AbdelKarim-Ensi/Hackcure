// T4.1 : service donneurs réel (inscription, profil, préférences, position consentie).
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { GeoPointDto } from '../common/dto/geo-point.dto';
import { Donor, User } from '../database/entities';
import { BloodGroup, Sex } from '../database/enums';
import type { DonorProfileDto, DonorRegisterDto, UpdateDonorDto } from './dto/donors.dto';

const PG_UNIQUE_VIOLATION = '23505';

/** GeoJSON attendu par PostGIS : [longitude, latitude]. */
const toGeoJson = (p: GeoPointDto) => ({ type: 'Point', coordinates: [p.longitude, p.latitude] });

@Injectable()
export class DonorsService {
  constructor(
    @InjectRepository(Donor) private readonly donors: Repository<Donor>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  toDto(d: Donor): DonorProfileDto {
    const coords = (d.position as { coordinates?: number[] } | null)?.coordinates;
    const prefs = d.notifPrefs as { alertsEnabled?: boolean; quietHours?: { start: string; end: string } | null };
    return {
      userId: d.userId,
      ...(d.user?.fullName ? { fullName: d.user.fullName } : {}),
      phone: d.user?.phone ?? '',
      bloodGroup: d.bloodGroup as unknown as DonorProfileDto['bloodGroup'],
      bloodGroupConfirmed: d.bloodGroupConfirmed,
      ...(d.sex ? { sex: d.sex as unknown as DonorProfileDto['sex'] } : {}),
      ...(d.zone ? { zone: d.zone } : {}),
      ...(coords ? { position: { latitude: coords[1], longitude: coords[0] } } : {}),
      available: d.available,
      eligibilityStatus: d.eligibilityStatus as unknown as DonorProfileDto['eligibilityStatus'],
      ...(d.reevalDate ? { reevalDate: d.reevalDate } : {}),
      ...(d.lastDonationDate ? { lastDonationDate: d.lastDonationDate } : {}),
      ...(d.nextDonationPossibleDate ? { nextDonationPossibleDate: d.nextDonationPossibleDate } : {}),
      maxRadiusKm: d.maxRadiusKm,
      notifPrefs: { alertsEnabled: prefs?.alertsEnabled ?? true, quietHours: prefs?.quietHours ?? null },
      ...(d.consentAt ? { consentAt: d.consentAt.toISOString() } : {}),
    };
  }

  /** Crée le profil d'un compte donneur. Le statut reste en_attente jusqu'au formulaire (T4.2). */
  async register(userId: string, dto: DonorRegisterDto): Promise<DonorProfileDto> {
    if (dto.consent !== true) {
      throw new BadRequestException('Le consentement explicite est obligatoire (santé et géolocalisation)');
    }
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Compte introuvable');
    if (await this.donors.exists({ where: { userId } })) {
      throw new ConflictException('Un profil donneur existe déjà pour ce compte');
    }
    try {
      await this.donors.save(
        this.donors.create({
          userId,
          bloodGroup: dto.bloodGroup as unknown as BloodGroup,
          bloodGroupConfirmed: false,
          sex: (dto.sex as unknown as Sex | undefined) ?? null,
          zone: dto.zone,
          position: toGeoJson(dto.position),
          available: dto.available ?? true,
          consentAt: new Date(),
        }),
      );
    } catch (e) {
      // Deux inscriptions simultanées : la clé primaire user_id tranche.
      if ((e as { code?: string }).code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException('Un profil donneur existe déjà pour ce compte');
      }
      throw e;
    }
    return this.getMe(userId);
  }

  async getMe(userId: string): Promise<DonorProfileDto> {
    return this.toDto(await this.findOrFail(userId));
  }

  /** Mise à jour partielle : seuls les champs présents dans le corps sont modifiés. */
  async updateMe(userId: string, dto: UpdateDonorDto): Promise<DonorProfileDto> {
    const donor = await this.findOrFail(userId);
    if (dto.zone !== undefined) donor.zone = dto.zone;
    if (dto.position !== undefined) donor.position = toGeoJson(dto.position);
    if (dto.available !== undefined) donor.available = dto.available;
    if (dto.maxRadiusKm !== undefined) donor.maxRadiusKm = dto.maxRadiusKm;
    if (dto.notifPrefs !== undefined) {
      donor.notifPrefs = {
        alertsEnabled: dto.notifPrefs.alertsEnabled,
        quietHours: dto.notifPrefs.quietHours ?? null,
      };
    }
    return this.toDto(await this.donors.save(donor));
  }

  private async findOrFail(userId: string): Promise<Donor> {
    const donor = await this.donors.findOne({ where: { userId }, relations: { user: true } });
    if (!donor) throw new NotFoundException("Profil donneur introuvable. Appelez d'abord POST /donors/register");
    return donor;
  }
}
