/**
 * Juego multijugador "Adivina el número" - Módulo SpacetimeDB (TypeScript)
 *
 * Un jugador crea una sala con un número secreto (1-100),
 * otros se unen e intentan adivinarlo. El primero en acertar gana.
 */

import { schema, table, t, SenderError } from 'spacetimedb/server';

// Tablas
const room = table(
  { name: 'Room', public: true },
  {
    room_id: t.u32().primaryKey(),
    host: t.identity(),
    secret_number: t.u8(),
    status: t.string(),
    winner: t.option(t.identity()),
    created_at: t.u64(),
  }
);

const roomPlayer = table(
  { name: 'RoomPlayer', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    room_id: t.u32(),
    identity: t.identity(),
    player_name: t.string(),
    joined_at: t.u64(),
  }
);

const guess = table(
  { name: 'Guess', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    room_id: t.u32(),
    player: t.identity(),
    guess: t.u8(),
    timestamp: t.u64(),
  }
);

const roomCounter = table(
  { name: 'RoomCounter', public: true },
  {
    dummy: t.u8().primaryKey(),
    next_id: t.u32(),
  }
);

const spacetimedb = schema({
  room,
  room_player: roomPlayer,
  guess,
  room_counter: roomCounter,
});

// Inicialización (se ejecuta una vez al publicar el módulo)
spacetimedb.init((ctx) => {
  if (ctx.db.room_counter.count() === 0n) {
    ctx.db.room_counter.insert({
      dummy: 0,
      next_id: 1,
    });
  }
});

// Reducer init por si el cliente necesita inicializar manualmente (ej. BD existente)
export const init = spacetimedb.reducer((ctx) => {
  if (ctx.db.room_counter.count() > 0n) {
    throw new SenderError('Ya inicializado');
  }
  ctx.db.room_counter.insert({
    dummy: 0,
    next_id: 1,
  });
});

export const create_room = spacetimedb.reducer(
  { secret_number: t.u8(), player_name: t.string() },
  (ctx, { secret_number, player_name }) => {
    if (secret_number < 1 || secret_number > 100) {
      throw new SenderError('El número debe estar entre 1 y 100');
    }
    if (!player_name?.trim() || player_name.length > 32) {
      throw new SenderError('Nombre inválido');
    }

    const counterRow = ctx.db.room_counter.dummy.find(0);
    if (!counterRow) {
      throw new SenderError('Sistema no inicializado. Ejecuta init primero.');
    }

    const room_id = counterRow.next_id;
    ctx.db.room_counter.dummy.update({
      ...counterRow,
      next_id: counterRow.next_id + 1,
    });

    const now = ctx.timestamp.microsSinceUnixEpoch;
    ctx.db.room.insert({
      room_id,
      host: ctx.sender,
      secret_number,
      status: 'Waiting',
      winner: undefined,
      created_at: now,
    });

    ctx.db.room_player.insert({
      id: 0n,
      room_id,
      identity: ctx.sender,
      player_name: player_name.trim(),
      joined_at: now,
    });
  }
);

export const join_room = spacetimedb.reducer(
  { room_id: t.u32(), player_name: t.string() },
  (ctx, { room_id, player_name }) => {
    if (!player_name?.trim() || player_name.length > 32) {
      throw new SenderError('Nombre inválido');
    }

    const roomRow = [...ctx.db.room.iter()].find((r) => r.room_id === room_id);
    if (!roomRow) {
      throw new SenderError('Sala no encontrada');
    }

    if (roomRow.status !== 'Waiting' && roomRow.status !== 'Playing') {
      throw new SenderError('La sala ya terminó');
    }

    const alreadyJoined = [...ctx.db.room_player.iter()].some(
      (p) => p.room_id === room_id && p.identity.equals(ctx.sender)
    );
    if (alreadyJoined) {
      throw new SenderError('Ya estás en esta sala');
    }

    const now = ctx.timestamp.microsSinceUnixEpoch;
    ctx.db.room_player.insert({
      id: 0n,
      room_id,
      identity: ctx.sender,
      player_name: player_name.trim(),
      joined_at: now,
    });

    const playerCount = [...ctx.db.room_player.iter()].filter(
      (p) => p.room_id === room_id
    ).length;
    if (playerCount >= 2 && roomRow.status === 'Waiting') {
      ctx.db.room.room_id.update({
        ...roomRow,
        status: 'Playing',
      });
    }
  }
);

export const guess_number = spacetimedb.reducer(
  { room_id: t.u32(), guess: t.u8() },
  (ctx, { room_id, guess }) => {
    if (guess < 1 || guess > 100) {
      throw new SenderError('El número debe estar entre 1 y 100');
    }

    const roomRow = [...ctx.db.room.iter()].find((r) => r.room_id === room_id);
    if (!roomRow) {
      throw new SenderError('Sala no encontrada');
    }

    if (roomRow.status === 'Finished') {
      throw new SenderError('El juego ya terminó');
    }

    if (roomRow.status === 'Waiting') {
      throw new SenderError('Esperando más jugadores');
    }

    const isPlayer = [...ctx.db.room_player.iter()].some(
      (p) => p.room_id === room_id && p.identity.equals(ctx.sender)
    );
    if (!isPlayer) {
      throw new SenderError('No estás en esta sala');
    }

    const now = ctx.timestamp.microsSinceUnixEpoch;
    ctx.db.guess.insert({
      id: 0n,
      room_id,
      player: ctx.sender,
      guess,
      timestamp: now,
    });

    if (guess === roomRow.secret_number) {
      ctx.db.room.room_id.update({
        ...roomRow,
        status: 'Finished',
        winner: ctx.sender,
      });
    }
  }
);

export const leave_room = spacetimedb.reducer({ room_id: t.u32() }, (ctx, { room_id }) => {
  const players = [...ctx.db.room_player.iter()].filter((p) => p.room_id === room_id);
  const player = players.find((p) => p.identity.equals(ctx.sender));
  if (!player) {
    throw new SenderError('No estás en esta sala');
  }
  ctx.db.room_player.delete(player);
});

export default spacetimedb;
