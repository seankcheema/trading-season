import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * The credential columns of the shared business `users` table.
 *
 * This entity maps only what authentication owns: identity, password hash,
 * role and lockout state. The profile columns — first_name, last_name, ssn,
 * address, date_of_birth, trader_level, available_funds — are absent on
 * purpose. An entity that does not declare a column can never write it, which
 * is what keeps this service out of the trading domain now that both services
 * read the same table.
 *
 * The schema is owned by Flyway in apps/business-backend/db/migrations, not by
 * this service. Column names are the business schema's, so every mapping below
 * is explicit.
 */
@Entity('users')
export class User {
  /**
   * The access token's `sub`.
   *
   * V003 dropped this column's database default because the value is set by
   * the application at registration. TypeORM's 'uuid' strategy generates it in
   * JavaScript and includes it in the INSERT, so that still holds.
   */
  @PrimaryGeneratedColumn('uuid', { name: 'user_id' })
  id: string;

  @Column({ name: 'email', type: 'text', unique: true })
  email: string;

  /** bcrypt hash — never the plaintext password. */
  @Column({ name: 'password_hash', type: 'text' })
  password: string;

  @Column({ name: 'user_role', type: 'text', default: 'TRADER' })
  role: 'ADMIN' | 'TRADER';

  /**
   * The business schema models deactivation as a status string rather than a
   * boolean. It is translated once, by `isActive` below, so no branch outside
   * this file has to learn about 'DEACTIVATED'.
   */
  @Column({ name: 'account_status', type: 'text', default: 'ACTIVE' })
  accountStatus: 'ACTIVE' | 'DEACTIVATED';

  /** Failed login counter for the lockout rule (KAN-46). */
  @Column({ name: 'failed_login_attempts', type: 'int', default: 0 })
  failedAttempts: number;

  /** Set while an account is locked out; NULL when it is not. */
  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  /**
   * Not a column. Presents `account_status` as the boolean that AuthService
   * and UsersService.mapToDto already read, so the status representation stays
   * contained to this entity.
   */
  get isActive(): boolean {
    return this.accountStatus === 'ACTIVE';
  }
}
