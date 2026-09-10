import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from '../users/user.entity.js';
import { InitialAuthSchema1789051037692 } from './migrations/1789051037692-InitialAuthSchema.js';

/**
 * DataSource used by the TypeORM CLI (npm run migration:*).
 *
 * The application itself does not use this — it builds its connection from
 * src/config/database.config.ts. Both must stay pointed at the same database
 * and the same migration list.
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  username: process.env.DB_USER || 'authuser',
  password: process.env.DB_PASSWORD || 'changeme',
  database: process.env.DB_NAME || 'auth_db',
  entities: [User],
  migrations: [InitialAuthSchema1789051037692],
  synchronize: false,
});
