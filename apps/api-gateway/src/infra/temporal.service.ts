import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Client, Connection } from '@temporalio/client';
import { env } from '../config/env';

@Injectable()
export class TemporalService implements OnModuleInit, OnModuleDestroy {
  private _connection!: Connection;
  private _client!: Client;

  async onModuleInit(): Promise<void> {
    this._connection = await Connection.connect({ address: env.TEMPORAL_ADDRESS });
    this._client = new Client({ connection: this._connection, namespace: env.TEMPORAL_NAMESPACE });
  }

  get client(): Client {
    return this._client;
  }

  async onModuleDestroy(): Promise<void> {
    await this._connection?.close();
  }
}
