import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './config/database.config.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { HealthModule } from './health/health.module.js';
import { SeedService } from './config/seed.service.js';
import { User } from './users/user.entity.js';

@Module({
  imports: [
    TypeOrmModule.forRoot(databaseConfig),
    TypeOrmModule.forFeature([User]),
    AuthModule,
    UsersModule,
    HealthModule,
  ],
  providers: [SeedService],
  exports: [SeedService],
})
export class AppModule {}
