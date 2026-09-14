import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Credential record for the auth service.
 *
 * Column names are snake_case to match the schema conventions used elsewhere in
 * the platform (see apps/business-backend/db/migrations/V001__Initial_schema.sql).
 * TypeScript property names stay camelCase, so the mapping is explicit on every
 * column rather than relying on a naming strategy.
 *
 * The table is created by a migration, not by synchronize — see
 * src/database/migrations/.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Required and unique. Collected at registration. */
  @Column({ name: 'username', type: 'text', unique: true })
  username: string;

  @Column({ name: 'email', type: 'text', unique: true })
  email: string;

  /** bcrypt hash — never the plaintext password. */
  @Column({ name: 'password_hash', type: 'text' })
  password: string;

  @Column({
    name: 'role',
    type: 'text',
    default: 'TRADER',
  })
  role: 'ADMIN' | 'TRADER';

  /** Failed login counter for the lockout rule (KAN-46). */
  @Column({ name: 'failed_attempts', type: 'int', default: 0 })
  failedAttempts: number;

  /** Set while an account is locked out; NULL when it is not. */
  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;

  @Column({ name: 'first_name', type: 'text' })
  firstName: string;

  @Column({ name: 'last_name', type: 'text' })
  lastName: string;

  /** false is the DEACTIVATED state referenced by KAN-86. */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
