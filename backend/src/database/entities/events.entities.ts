import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { BloodGroup, EventStatus, RegistrationStatus } from '../enums';
import { Donor, User } from './identity.entities';

@Entity('events')
export class CrtEvent {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) organizerId!: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'organizer_id' }) organizer?: User;
  @Column({ type: 'varchar', length: 160 }) title!: string;
  @Column({ type: 'varchar', length: 160 }) placeName!: string;
  @Column({ type: 'text', nullable: true }) address!: string | null;
  @Index({ spatial: true })
  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326, nullable: true }) position!: object | null;
  @Column({ type: 'date' }) eventDate!: string;
  @Column({ type: 'jsonb', default: () => `'[]'` }) slots!: string[];
  @Column({ type: 'int' }) capacity!: number;
  @Column({ type: 'enum', enum: BloodGroup, enumName: 'blood_group', array: true, nullable: true }) targetGroups!: BloodGroup[] | null;
  @Column({ type: 'text', nullable: true }) conditions!: string | null;
  @Column({ type: 'enum', enum: EventStatus, enumName: 'event_status', default: EventStatus.Publie }) status!: EventStatus;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}

@Entity('event_registrations')
@Unique(['eventId', 'donorId'])
export class EventRegistration {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) eventId!: string;
  @ManyToOne(() => CrtEvent, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'event_id' }) event?: CrtEvent;
  @Column({ type: 'uuid' }) donorId!: string;
  @ManyToOne(() => Donor, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'donor_id' }) donor?: Donor;
  @Column({ type: 'varchar', length: 20 }) slot!: string;
  @Column({ type: 'enum', enum: RegistrationStatus, enumName: 'registration_status', default: RegistrationStatus.Inscrit })
  status!: RegistrationStatus;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
