import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from './refresh-token.entity.js';
import { RefreshTokensService } from './refresh-tokens.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([RefreshToken])],
  providers: [RefreshTokensService],
  exports: [RefreshTokensService],
})
export class RefreshTokensModule {}
