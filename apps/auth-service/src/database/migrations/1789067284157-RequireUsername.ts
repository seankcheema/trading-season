import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes users.username mandatory.
 *
 * The column was created nullable because registration did not yet collect a
 * username, and a NOT NULL column would have rejected every signup. Now that
 * POST /auth/register requires one, the constraint can be applied.
 *
 * Any pre-existing rows with a NULL username are backfilled from the local
 * part of their email, suffixed if that collides.
 */
export class RequireUsername1789067284157 implements MigrationInterface {
  name = 'RequireUsername1789067284157';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "users"
      SET "username" = split_part("email", '@', 1) || '_' || left("id"::text, 8)
      WHERE "username" IS NULL
    `);

    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "username" DROP NOT NULL`,
    );
  }
}
