import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A credential record, in the shared business database.
 *
 * Lives in `user_accounts`, a table the auth service owns outright. The
 * customer profile is a separate `users` row keyed by the same id and written
 * only by the Java services; this entity cannot reach it. Splitting the two is
 * what lets each table keep a single writer now that one database holds both.
 *
 * The schema is owned by Flyway in apps/market-data/db/migrations, not by this
 * service, so every column mapping below is explicit.
 */
@Entity('user_accounts')
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
}
