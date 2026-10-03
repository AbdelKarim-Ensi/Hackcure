import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DonationSource, DonationType, EligibilityStatus } from '../enums';
import { Donor, User } from './identity.entities';

@Entity('eligibility_forms')
export class EligibilityForm {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) donorId!: string;
  @ManyToOne(() => Donor, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'donor_id' }) donor?: Donor;
  // Texte chiffré (AES-256-GCM, branché en T7.1)
  @Column({ type: 'text' }) answersEncrypted!: string;
  @Column({ type: 'enum', enum: EligibilityStatus, enumName: 'eligibility_status' }) result!: EligibilityStatus;
  @Column({ type: 'varchar', length: 20 }) questionnaireVersion!: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}

@Entity('donations')
export class Donation {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) donorId!: string;
  @ManyToOne(() => Donor, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'donor_id' }) donor?: Donor;
  @Column({ type: 'enum', enum: DonationType, enumName: 'donation_type' }) type!: DonationType;
  @Column({ type: 'date' }) donatedAt!: string;
  @Column({ type: 'varchar', length: 160, nullable: true }) place!: string | null;
  @Column({ type: 'enum', enum: DonationSource, enumName: 'donation_source' }) source!: DonationSource;
  @Column({ type: 'uuid', nullable: true }) confirmedBy!: string | null;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' }) @JoinColumn({ name: 'confirmed_by' }) confirmer?: User | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
