import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { BloodGroup, NotificationStatus, NotificationType } from '../enums';
import { Institution, User } from './identity.entities';

@Entity('stocks')
export class Stock {
  @PrimaryColumn('uuid') institutionId!: string;
  @ManyToOne(() => Institution, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'institution_id' }) institution?: Institution;
  @PrimaryColumn({ type: 'enum', enum: BloodGroup, enumName: 'blood_group' }) bloodGroup!: BloodGroup;
  @Column({ type: 'int', default: 0 }) quantity!: number;
  @Column({ type: 'int', default: 10 }) alertThreshold!: number;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}

@Entity('notifications')
export class AppNotification {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) userId!: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'user_id' }) user?: User;
  @Column({ type: 'enum', enum: NotificationType, enumName: 'notification_type' }) type!: NotificationType;
  @Column({ type: 'enum', enum: NotificationStatus, enumName: 'notification_status', default: NotificationStatus.EnAttente })
  status!: NotificationStatus;
  @Column({ type: 'uuid', nullable: true }) requestId!: string | null;
  @Column({ type: 'uuid', nullable: true }) eventId!: string | null;
  @Column({ type: 'jsonb', default: () => `'{}'` }) payload!: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @Column({ type: 'timestamptz', nullable: true }) sentAt!: Date | null;
}

@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', nullable: true }) actorId!: string | null;
  @Column({ type: 'varchar', length: 80 }) action!: string;
  @Column({ type: 'varchar', length: 60, nullable: true }) entity!: string | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) entityId!: string | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) ip!: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
