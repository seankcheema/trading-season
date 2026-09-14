import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../users/user.entity.js';
import { RefreshToken } from '../refresh-tokens/refresh-token.entity.js';
import { RequireUsername1789067284157 } from '../database/migrations/1789067284157-RequireUsername.js';
import { InitialAuthSchema1789051037692 } from '../database/migrations/1789051037692-InitialAuthSchema.js';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  username: process.env.DB_USER || 'authuser',
  password: process.env.DB_PASSWORD || 'changeme',
  database: process.env.DB_NAME || 'auth_db',
  entities: [User, RefreshToken],

  // The schema is owned by the migrations below, in every environment.
  // synchronize would let TypeORM silently alter tables to match the entities,
  // which makes the real schema a function of whatever code last booted.
  synchronize: false,

  // Migration classes are listed explicitly rather than matched by a glob.
  // Globs resolve against compiled output, which differs between `nest start`
  // and `node dist/main.js` under ESM; an explicit list cannot drift.
  migrations: [InitialAuthSchema1789051037692, RequireUsername1789067284157],
  migrationsRun: true,

  logging: process.env.NODE_ENV === 'development',
};
