import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../users/user.entity.js';
import { RefreshToken } from '../refresh-tokens/refresh-token.entity.js';
import { PasswordResetToken } from '../password-reset/password-reset-token.entity.js';
import { PasswordResetTokens1790686840697 } from '../database/migrations/1790686840697-PasswordResetTokens.js';

/**
 * Connection to the shared business database.
 *
 * This service no longer has a database of its own. It owns two tables inside
 * `trading_season`: `user_accounts` and `refresh_tokens`. The customer profile
 * in `users` belongs to the Java services and is never touched from here.
 *
 * It currently connects as the application role, which can read every trading
 * table. A role granted only those two tables would restore most of the
 * isolation the separate database used to provide, and is worth doing before
 * this reaches anything but a development machine.
 */
export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'trading_season',
  password: process.env.DB_PASSWORD || 'changeme',
  database: process.env.DB_NAME || 'trading_season',
  entities: [User, RefreshToken],

  // The schema belongs to the migrations in apps/market-data/db/migrations.
  // Two migration tools pointed at one database is how half a schema gets
  // dropped, so this service reads and writes tables it never creates.
  //
  // It therefore assumes Flyway has already run. If it has not, queries fail
  // against missing columns — which is the correct failure, and louder than
  // quietly building a second schema of its own.
  synchronize: false,

  // Migration classes are listed explicitly rather than matched by a glob.
  // Globs resolve against compiled output, which differs between `nest start`
  // and `node dist/main.js` under ESM; an explicit list cannot drift.
  migrations: [
    PasswordResetTokens1790686840697,
  ],
  migrationsRun: true,

  logging: process.env.NODE_ENV === 'development',
};
