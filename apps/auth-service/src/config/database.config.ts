import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../users/user.entity.js';
import { RefreshToken } from '../refresh-tokens/refresh-token.entity.js';

/**
 * Connection to the shared business database.
 *
 * This service no longer has a database of its own. It reads and writes the
 * credential columns of `users` and owns `refresh_tokens`, both inside
 * `trading_season`.
 *
 * It currently connects as the application role, which can read every trading
 * table. A dedicated role granted only `users` and `refresh_tokens` would
 * restore some of the isolation the separate database used to provide, and is
 * worth doing before this reaches anything but a development machine.
 */
export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'trading_season',
  password: process.env.DB_PASSWORD || 'changeme',
  database: process.env.DB_NAME || 'trading_season',
  entities: [User, RefreshToken],

  // The schema belongs to Flyway, in apps/business-backend/db/migrations.
  // Two migration tools pointed at one database is how half a schema gets
  // dropped, so this service reads and writes tables it never creates.
  //
  // It therefore assumes Flyway has already run. If it has not, queries fail
  // against missing columns — which is the correct failure, and louder than
  // quietly building a second schema of its own.
  synchronize: false,
  migrations: [],
  migrationsRun: false,

  logging: process.env.NODE_ENV === 'development',
};
