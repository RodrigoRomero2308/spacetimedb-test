/**
 * Module bindings para el juego "Adivina el número"
 * Generados manualmente para el módulo SpacetimeDB
 */

import {
  DbConnectionBuilder as __DbConnectionBuilder,
  DbConnectionImpl as __DbConnectionImpl,
  SubscriptionBuilderImpl as __SubscriptionBuilderImpl,
  schema as __schema,
  table as __table,
  reducerSchema as __reducerSchema,
  reducers as __reducers,
  procedures as __procedures,
  makeQueryBuilder as __makeQueryBuilder,
  t as __t,
  type DbConnectionConfig,
  type ErrorContextInterface,
  type EventContextInterface,
  type QueryBuilder,
  type ReducerEventContextInterface,
  type SubscriptionEventContextInterface,
  type SubscriptionHandleImpl,
} from 'spacetimedb';

// Tablas - los nombres deben coincidir con el módulo Rust
const tablesSchema = __schema({
  room: __table({ name: 'Room', public: true }, {
    room_id: __t.u32().primaryKey(),
    host: __t.identity(),
    secret_number: __t.u8(),
    status: __t.string(),
    winner: __t.option(__t.identity()),
    created_at: __t.u64(),
  }),
  room_player: __table({ name: 'RoomPlayer', public: true }, {
    id: __t.u64().primaryKey().autoInc(),
    room_id: __t.u32(),
    identity: __t.identity(),
    player_name: __t.string(),
    joined_at: __t.u64(),
  }),
  guess: __table({ name: 'Guess', public: true }, {
    id: __t.u64().primaryKey().autoInc(),
    room_id: __t.u32(),
    player: __t.identity(),
    guess: __t.u8(),
    timestamp: __t.u64(),
  }),
  room_counter: __table({ name: 'RoomCounter', public: true }, {
    dummy: __t.u8().primaryKey(),
    next_id: __t.u32(),
  }),
});

// Reducers
const reducersSchema = __reducers(
  __reducerSchema('init', {}),
  __reducerSchema('create_room', {
    secret_number: __t.u8(),
    player_name: __t.string(),
  }),
  __reducerSchema('join_room', {
    room_id: __t.u32(),
    player_name: __t.string(),
  }),
  __reducerSchema('guess_number', {
    room_id: __t.u32(),
    guess: __t.u8(),
  }),
  __reducerSchema('leave_room', {
    room_id: __t.u32(),
  })
);

const proceduresSchema = __procedures();

const REMOTE_MODULE = {
  versionInfo: { cliVersion: '2.0.0' as const },
  tables: tablesSchema.schemaType.tables,
  reducers: reducersSchema.reducersType.reducers,
  ...proceduresSchema,
};

// Tipos exportados (definidos manualmente según el esquema)
import type { Identity } from 'spacetimedb';

export interface Room {
  room_id: number;
  host: Identity;
  secret_number: number;
  status: string;
  winner: Identity | undefined;
  created_at: bigint;
}

export interface RoomPlayer {
  id: bigint;
  room_id: number;
  identity: Identity;
  player_name: string;
  joined_at: bigint;
}

export interface Guess {
  id: bigint;
  room_id: number;
  player: Identity;
  guess: number;
  timestamp: bigint;
}

export interface RoomCounter {
  dummy: number;
  next_id: number;
}

export const tables: QueryBuilder<typeof tablesSchema.schemaType> =
  __makeQueryBuilder(tablesSchema.schemaType);

export type EventContext = EventContextInterface<typeof REMOTE_MODULE>;
export type ReducerEventContext = ReducerEventContextInterface<typeof REMOTE_MODULE>;
export type SubscriptionEventContext = SubscriptionEventContextInterface<typeof REMOTE_MODULE>;
export type ErrorContext = ErrorContextInterface<typeof REMOTE_MODULE>;
export type SubscriptionHandle = SubscriptionHandleImpl<typeof REMOTE_MODULE>;

export class SubscriptionBuilder extends __SubscriptionBuilderImpl<typeof REMOTE_MODULE> {}

export class DbConnectionBuilder extends __DbConnectionBuilder<DbConnection> {}

export class DbConnection extends __DbConnectionImpl<typeof REMOTE_MODULE> {
  static builder(): DbConnectionBuilder {
    return new DbConnectionBuilder(
      REMOTE_MODULE,
      (config: DbConnectionConfig<typeof REMOTE_MODULE>) => new DbConnection(config)
    );
  }

}
