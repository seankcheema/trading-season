import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordResetToken } from './password-reset-token.entity.js';
import { PasswordResetTokensService } from './password-reset-tokens.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([PasswordResetToken])],
  providers: [PasswordResetTokensService],
  exports: [PasswordResetTokensService],
})
export class PasswordResetTokensModule {}
