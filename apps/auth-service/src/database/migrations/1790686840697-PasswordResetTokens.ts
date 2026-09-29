import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the table backing the password reset flow (KAN-89).
 *
 * Only the SHA-256 hash of the reset token is stored, for the same reason
 * refresh_tokens stores a hash: the raw value reaches the user's mailbox and
 * nowhere else, so a leak of this table hands over nothing usable.
 *
 * used_at and revoked_at are separate states rather than one flag. used_at
 * records the token that actually changed a password; revoked_at records one
 * that never will, because a newer request superseded it or the password
 * changed by another route. Collapsing them would make an audit of "which link
 * was used" unanswerable.
 */
export class PasswordResetTokens1790686840697 implements MigrationInterface {
  name = 'PasswordResetTokens1790686840697';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "password_reset_tokens" (
        "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"    UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token_hash" TEXT NOT NULL UNIQUE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMPTZ NOT NULL,
        "used_at"    TIMESTAMPTZ,
        "revoked_at" TIMESTAMPTZ
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_password_reset_tokens_user_id" ON "password_reset_tokens" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_password_reset_tokens_expires_at" ON "password_reset_tokens" ("expires_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "password_reset_tokens"`);
  }
}
