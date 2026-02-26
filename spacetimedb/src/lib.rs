//! Juego multijugador simple con SpacetimeDB 2.0
//! Juego: "Adivina el número" - Un jugador crea una sala con un número secreto,
//! otros se unen e intentan adivinarlo. El primero en acertar gana.

use spacetimedb::{Identity, ReducerContext, Table};

/// Estado de una sala de juego
#[spacetimedb::table(accessor = room)]
pub struct Room {
    #[primary_key]
    pub room_id: u32,
    /// Creador de la sala (quien eligió el número)
    pub host: Identity,
    /// Número secreto a adivinar (1-100)
    pub secret_number: u8,
    /// Estado: Waiting (esperando jugadores), Playing (en juego), Finished (terminado)
    pub status: String,
    /// Ganador si status == "Finished"
    pub winner: Option<Identity>,
    pub created_at: u64,
}

/// Jugadores en una sala
#[spacetimedb::table(accessor = room_player)]
pub struct RoomPlayer {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub room_id: u32,
    pub identity: Identity,
    pub player_name: String,
    pub joined_at: u64,
}

/// Intentos de adivinar
#[spacetimedb::table(accessor = guess)]
pub struct Guess {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub room_id: u32,
    pub player: Identity,
    pub guess: u8,
    pub timestamp: u64,
}

/// Contador para IDs de sala auto-incrementados
#[spacetimedb::table(accessor = room_counter)]
pub struct RoomCounter {
    #[primary_key]
    pub dummy: u8,
    pub next_id: u32,
}

#[spacetimedb::reducer]
pub fn init(ctx: &ReducerContext) -> Result<(), String> {
    if ctx.db.room_counter().iter().next().is_some() {
        return Err("Ya inicializado".to_string());
    }
    ctx.db.room_counter().insert(RoomCounter {
        dummy: 0,
        next_id: 1,
    });
    Ok(())
}

#[spacetimedb::reducer]
pub fn create_room(
    ctx: &ReducerContext,
    secret_number: u8,
    player_name: String,
) -> Result<(), String> {
    if secret_number < 1 || secret_number > 100 {
        return Err("El número debe estar entre 1 y 100".to_string());
    }
    if player_name.is_empty() || player_name.len() > 32 {
        return Err("Nombre inválido".to_string());
    }

    let mut counter = ctx
        .db
        .room_counter()
        .iter()
        .next()
        .ok_or("Sistema no inicializado. Ejecuta init() primero.")?;

    let room_id = counter.next_id;
    counter.next_id += 1;
    ctx.db.room_counter().dummy().update(counter);

    let now = ctx.timestamp.to_micros_since_unix_epoch() as u64;
    ctx.db.room().insert(Room {
        room_id,
        host: ctx.sender(),
        secret_number,
        status: "Waiting".to_string(),
        winner: None,
        created_at: now,
    });

    ctx.db.room_player().insert(RoomPlayer {
        id: 0,
        room_id,
        identity: ctx.sender(),
        player_name: player_name.clone(),
        joined_at: now,
    });

    log::info!(
        "Sala {} creada por {} con número secreto",
        room_id,
        player_name
    );
    Ok(())
}

#[spacetimedb::reducer]
pub fn join_room(ctx: &ReducerContext, room_id: u32, player_name: String) -> Result<(), String> {
    if player_name.is_empty() || player_name.len() > 32 {
        return Err("Nombre inválido".to_string());
    }

    let room = ctx
        .db
        .room()
        .iter()
        .find(|r| r.room_id == room_id)
        .ok_or("Sala no encontrada")?;

    if room.status != "Waiting" && room.status != "Playing" {
        return Err("La sala ya terminó".to_string());
    }

    let already_joined = ctx
        .db
        .room_player()
        .iter()
        .any(|p| p.room_id == room_id && p.identity == ctx.sender());
    if already_joined {
        return Err("Ya estás en esta sala".to_string());
    }

    let now = ctx.timestamp.to_micros_since_unix_epoch() as u64;
    ctx.db.room_player().insert(RoomPlayer {
        id: 0,
        room_id,
        identity: ctx.sender(),
        player_name,
        joined_at: now,
    });

    // Si el host era el único, cambiar a Playing
    let player_count = ctx.db.room_player().iter().filter(|p| p.room_id == room_id).count();
    if player_count >= 2 && room.status == "Waiting" {
        ctx.db.room().room_id().update(Room {
            room_id,
            host: room.host,
            secret_number: room.secret_number,
            status: "Playing".to_string(),
            winner: None,
            created_at: room.created_at,
        });
    }

    Ok(())
}

#[spacetimedb::reducer]
pub fn guess_number(ctx: &ReducerContext, room_id: u32, guess: u8) -> Result<(), String> {
    if guess < 1 || guess > 100 {
        return Err("El número debe estar entre 1 y 100".to_string());
    }

    let room = ctx
        .db
        .room()
        .iter()
        .find(|r| r.room_id == room_id)
        .ok_or("Sala no encontrada")?;

    if room.status == "Finished" {
        return Err("El juego ya terminó".to_string());
    }

    if room.status == "Waiting" {
        return Err("Esperando más jugadores".to_string());
    }

    let is_player = ctx
        .db
        .room_player()
        .iter()
        .any(|p| p.room_id == room_id && p.identity == ctx.sender());
    if !is_player {
        return Err("No estás en esta sala".to_string());
    }

    let now = ctx.timestamp.to_micros_since_unix_epoch() as u64;
    ctx.db.guess().insert(Guess {
        id: 0,
        room_id,
        player: ctx.sender(),
        guess,
        timestamp: now,
    });

    if guess == room.secret_number {
        ctx.db.room().room_id().update(Room {
            room_id,
            host: room.host,
            secret_number: room.secret_number,
            status: "Finished".to_string(),
            winner: Some(ctx.sender()),
            created_at: room.created_at,
        });
        log::info!("¡Jugador {} ganó la sala {}!", ctx.sender().to_string(), room_id);
    }

    Ok(())
}

#[spacetimedb::reducer]
pub fn leave_room(ctx: &ReducerContext, room_id: u32) -> Result<(), String> {
    let players: Vec<_> = ctx
        .db
        .room_player()
        .iter()
        .filter(|p| p.room_id == room_id)
        .collect();

    let player = players
        .iter()
        .find(|p| p.identity == ctx.sender())
        .ok_or("No estás en esta sala")?;

    ctx.db.room_player().id().delete(player.id);
    Ok(())
}
