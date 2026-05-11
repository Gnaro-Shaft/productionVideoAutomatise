import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { env } from '../../config/env';

/**
 * V1: local single-user bypass — injects {orgId, userId} from .env onto the request.
 * V3: swap implementation to JWT/OAuth without changing controllers.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    if (env.LOCAL_ORG_ID && env.LOCAL_USER_ID) {
      req.auth = {
        orgId: env.LOCAL_ORG_ID,
        userId: env.LOCAL_USER_ID,
      };
      return true;
    }

    throw new UnauthorizedException(
      'No auth context available. Set LOCAL_ORG_ID and LOCAL_USER_ID in .env (run pnpm db:seed).',
    );
  }
}
