import { Client, Connection } from '@temporalio/client';
import { env } from '../config';

let _client: Client | undefined;

export async function temporalClient(): Promise<Client> {
  if (!_client) {
    const connection = await Connection.connect({ address: env.TEMPORAL_ADDRESS });
    _client = new Client({ connection, namespace: env.TEMPORAL_NAMESPACE });
  }
  return _client;
}
