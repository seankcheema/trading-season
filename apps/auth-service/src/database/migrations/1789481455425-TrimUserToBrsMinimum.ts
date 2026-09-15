import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reduces users to the columns the business requirements actually call for.
 *
 * LEAP-BRS-2026-014 asks three things of this service: register and sign in
 * (BR-01), a client acting only on their own data (BR-02), and a session that
 * is time-limited and revocable (BR-03). Identity is the token's `sub`, and
 * authorization is `role`. Every column dropped below backs a feature no
 * requirement asks for:
 *
 *   username               sign-in is by email
 *   first_name, last_name  §4.2 puts client onboarding out of scope
 *   email_verified         nothing confirms an address, so the flag never moves
 *
 * is_active, failed_attempts and locked_until stay. No BRS requirement asks for
 * deactivation or lockout, but KAN-86 and KAN-46 do, and both are delivered and
 * tested — withdrawing them is a backlog decision, not a tidying one.
 *
 * Dropping username also drops its UNIQUE constraint; email remains unique and
 * is the only login identifier.
 */
export class TrimUserToBrsMinimum1789481455425 implements MigrationInterface {
  name = 'TrimUserToBrsMinimum1789481455425';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN "username",
        DROP COLUMN "first_name",
        DROP COLUMN "last_name",
        DROP COLUMN "email_verified"
    `);
  }

  /**
   * Restores the shape, not the data — the dropped values are gone.
   *
   * first_name and last_name were NOT NULL. They come back nullable, because
   * re-adding a NOT NULL column to a table that already has rows fails, and
   * inventing a placeholder name for a real person is worse than a null.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "username"       TEXT UNIQUE,
        ADD COLUMN "first_name"     TEXT,
        ADD COLUMN "last_name"      TEXT,
        ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false
    `);
  }
}
