import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export interface AuthContext {
  orgId: string;
  userId: string;
}

/**
 * Reads `req.auth` populated by AuthGuard.
 *   create(@Body() dto: CreateProjectDto, @Auth() auth: AuthContext)
 */
export const Auth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const req = ctx.switchToHttp().getRequest();
    return req.auth;
  },
);
