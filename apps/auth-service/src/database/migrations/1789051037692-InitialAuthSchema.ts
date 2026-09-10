import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the auth service schema.
 *
 * This is the sole source of the schema — database.config.ts sets
 * synchronize: false, so TypeORM will never create or alter these tables on its
 * own. Never edit this file once it has run anywhere; add a new migration.
 */
export class InitialAuthSchema1789051037692 implements MigrationInterface {
  name = 'InitialAuthSchema1789051037692';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // gen_random_uuid() lives in pgcrypto on Postgres 16.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "username"        TEXT UNIQUE,
        "email"           TEXT NOT NULL UNIQUE,
        "password_hash"   TEXT NOT NULL,
        "role"            TEXT NOT NULL DEFAULT 'TRADER'
                              CHECK ("role" IN ('ADMIN', 'TRADER')),
        "failed_attempts" INTEGER NOT NULL DEFAULT 0,
        "locked_until"    TIMESTAMPTZ,
        "first_name"      TEXT NOT NULL,
        "last_name"       TEXT NOT NULL,
        "is_active"       BOOLEAN NOT NULL DEFAULT true,
        "email_verified"  BOOLEAN NOT NULL DEFAULT false,
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // Refresh tokens are stored server-side so a single session can be revoked.
    // token_hash is SHA-256 of the opaque token, never the token itself: a
    // 256-bit random value is not brute-forceable, so a slow KDF such as bcrypt
    // would buy nothing and would cost the indexed lookup.
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id"     UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token_hash"  TEXT NOT NULL UNIQUE,
        "issued_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        "expires_at"  TIMESTAMPTZ NOT NULL,
        "revoked_at"  TIMESTAMPTZ,
        "replaced_by" UUID REFERENCES "refresh_tokens"("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_refresh_tokens_user_id" ON "refresh_tokens" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_refresh_tokens_expires_at" ON "refresh_tokens" ("expires_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
