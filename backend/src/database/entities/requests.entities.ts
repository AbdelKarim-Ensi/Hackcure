import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { BloodGroup, RequestStatus, ResponseType, UrgencyLevel } from '../enums';
import { Donor, Institution, User } from './identity.entities';

@Entity('blood_requests')
export class BloodRequest {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) institutionId!: string;
  @ManyToOne(() => Institution) @JoinColumn({ name: 'institution_id' }) institution?: Institution;
  @Column({ type: 'uuid', nullable: true }) createdBy!: string | null;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' }) @JoinColumn({ name: 'created_by' }) creator?: User | null;
  @Column({ type: 'enum', enum: BloodGroup, enumName: 'blood_group' }) bloodGroup!: BloodGroup;
  @Column({ type: 'int' }) quantity!: number;
  @Column({ type: 'enum', enum: UrgencyLevel, enumName: 'urgency_level', default: UrgencyLevel.Urgente }) urgency!: UrgencyLevel;
  @Column({ type: 'timestamptz' }) deadline!: Date;
  @Column({ type: 'int', default: 10 }) initialRadiusKm!: number;
  @Column({ type: 'int', default: 10 }) currentRadiusKm!: number;
  @Column({ type: 'int', default: 30 }) maxRadiusKm!: number;
  @Column({ type: 'enum', enum: RequestStatus, enumName: 'request_status', default: RequestStatus.Active }) status!: RequestStatus;
  @Column({ type: 'numeric', precision: 4, scale: 3, nullable: true }) anomalyScore!: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @Column({ type: 'timestamptz', nullable: true }) closedAt!: Date | null;
}

@Entity('request_waves')
@Unique(['requestId', 'waveNumber'])
export class RequestWave {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) requestId!: string;
  @ManyToOne(() => BloodRequest, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'request_id' }) request?: BloodRequest;
  @Column({ type: 'int' }) waveNumber!: number;
  @Column({ type: 'int' }) radiusKm!: number;
  @Column({ type: 'int', default: 0 }) sentTo!: number;
  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 }) coverage!: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}

@Entity('request_responses')
@Unique(['requestId', 'donorId'])
export class RequestResponse {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) requestId!: string;
  @ManyToOne(() => BloodRequest, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'request_id' }) request?: BloodRequest;
  @Column({ type: 'uuid' }) donorId!: string;
  @ManyToOne(() => Donor, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'donor_id' }) donor?: Donor;
  @Column({ type: 'enum', enum: ResponseType, enumName: 'response_type' }) response!: ResponseType;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
