import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity.js';
import { UsersService } from './users.service.js';
import { SignInPublisher } from '../events/sign-in-publisher.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService, SignInPublisher],
  exports: [UsersService, SignInPublisher],
})
export class UsersModule {}
