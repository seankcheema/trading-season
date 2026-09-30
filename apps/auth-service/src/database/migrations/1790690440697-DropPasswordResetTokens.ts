import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops the table that backed the password reset flow.
 *
 * The flow has been removed, so nothing reads or writes this table any more.
 * It is dropped rather than left in place because the rows are token hashes
 * tied to live accounts, and an unmaintained table of credential material is
 * worse than no table at all.
 *
 * The indexes go with the table; PostgreSQL drops them as part of DROP TABLE.
 * down() recreates the table and its indexes exactly as
 * PasswordResetTokens1790686840697 built them, so rolling this migration back
 * restores the schema — not the rows, which are gone for good.
 */
export class DropPasswordResetTokens1790690440697 implements MigrationInterface {
  name = 'DropPasswordResetTokens1790690440697';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "password_reset_tokens"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
}
