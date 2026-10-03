import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToOne, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { BloodGroup, EligibilityStatus, InstitutionType, Sex, UserRole, UserStatus, ValidationStatus } from '../enums';

@Entity('institutions')
export class Institution {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 160 }) name!: string;
  @Column({ type: 'enum', enum: InstitutionType, enumName: 'institution_type' }) type!: InstitutionType;
  @Column({ type: 'enum', enum: ValidationStatus, enumName: 'validation_status', default: ValidationStatus.EnAttente })
  validationStatus!: ValidationStatus;
  @Column({ type: 'text', nullable: true }) address!: string | null;
  @Index({ spatial: true })
  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326, nullable: true }) position!: object | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'enum', enum: UserRole, enumName: 'user_role' }) role!: UserRole;
  @Column({ type: 'varchar', length: 20, unique: true }) phone!: string;
  @Column({ type: 'varchar', length: 120, nullable: true }) fullName!: string | null;
  @Column({ type: 'text' }) passwordHash!: string;
  @Column({ type: 'boolean', default: false }) phoneVerified!: boolean;
  @Column({ type: 'enum', enum: UserStatus, enumName: 'user_status', default: UserStatus.Actif }) status!: UserStatus;
  @Column({ type: 'text', nullable: true }) fcmToken!: string | null;
  @Column({ type: 'uuid', nullable: true }) institutionId!: string | null;
  @ManyToOne(() => Institution, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'institution_id' }) institution?: Institution | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}

@Entity('donors')
export class Donor {
  @PrimaryColumn('uuid') userId!: string;
  @OneToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'user_id' }) user?: User;
  @Column({ type: 'enum', enum: BloodGroup, enumName: 'blood_group' }) bloodGroup!: BloodGroup;
  @Column({ type: 'boolean', default: false }) bloodGroupConfirmed!: boolean;
  @Column({ type: 'enum', enum: Sex, enumName: 'sex', nullable: true }) sex!: Sex | null;
  @Index({ spatial: true })
  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326, nullable: true }) position!: object | null;
  @Column({ type: 'varchar', length: 80, nullable: true }) zone!: string | null;
  @Column({ type: 'boolean', default: true }) available!: boolean;
  @Column({ type: 'enum', enum: EligibilityStatus, enumName: 'eligibility_status', default: EligibilityStatus.EnAttente })
  eligibilityStatus!: EligibilityStatus;
  @Column({ type: 'date', nullable: true }) reevalDate!: string | null;
  @Column({ type: 'date', nullable: true }) lastDonationDate!: string | null;
  @Column({ type: 'date', nullable: true }) nextDonationPossibleDate!: string | null;
  @Column({ type: 'int', default: 20 }) maxRadiusKm!: number;
  @Column({ type: 'jsonb', default: () => `'{"alertsEnabled":true,"quietHours":null}'` }) notifPrefs!: Record<string, unknown>;
  @Column({ type: 'timestamptz', nullable: true }) consentAt!: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
