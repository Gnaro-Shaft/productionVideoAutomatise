/**
 * @pva/sdk-ts — TypeScript client for the api-gateway.
 *
 * Re-exports all contracts from @pva/shared-types so consumers
 * have a single import surface:
 *
 *   import { CreateProjectInput, WsEventEnvelope, ... } from '@pva/sdk-ts';
 *
 * The actual fetch/socket client implementation will land here once
 * the api-gateway exists. For now this package is contracts-only.
 */
export * from '@pva/shared-types';

// Stubs — to be implemented when api-gateway is up:
// export { createPvaClient } from './client';
// export { createPvaSocket } from './socket';
