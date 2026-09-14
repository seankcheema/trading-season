import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtKeysService } from '../services/jwt-keys.service.js';
import { JwtPayload } from '../dto/jwt-payload.dto.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(jwtKeysService: JwtKeysService) {
    const publicKey = jwtKeysService?.getPublicKeyObject();
    
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      secretOrPublicKey: publicKey,
    } as any);
  }

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
