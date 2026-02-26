import { useState, useEffect } from 'react';
import { Identity } from 'spacetimedb';
import {
  DbConnection,
  type Room,
  type RoomPlayer,
} from './module_bindings';

const SPACETIMEDB_URI = (import.meta as { env?: Record<string, string> }).env?.VITE_SPACETIMEDB_URI || 'ws://localhost:3000';
const DB_NAME = (import.meta as { env?: Record<string, string> }).env?.VITE_SPACETIMEDB_DB || 'juego-multijugador';

function App() {
  const [conn, setConn] = useState<DbConnection | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [view, setView] = useState<'lobby' | 'create' | 'join' | 'game'>('lobby');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [guess, setGuess] = useState('');
  const [error, setError] = useState('');
  const [secretNumber, setSecretNumber] = useState('50');
  const [joinRoomId, setJoinRoomId] = useState('');

  useEffect(() => {
    const connection = DbConnection.builder()
      .withUri(SPACETIMEDB_URI)
      .withDatabaseName(DB_NAME)
      .onConnect(async (connection, ident, _token) => {
        setConn(connection);
        setIdentity(ident);
        setError('');
        // Inicializar el sistema si es la primera vez
        try {
          await connection.reducers.init({});
        } catch {
          // Ignorar si ya está inicializado
        }
      })
      .onConnectError((_ctx, err) => {
        setError(`Error de conexión: ${err.message}`);
      })
      .onDisconnect((_ctx, err) => {
        setConn(null);
        setIdentity(null);
        if (err) setError(`Desconectado: ${err.message}`);
      })
      .build();

    return () => connection.disconnect();
  }, []);

  useEffect(() => {
    if (!conn) return;

    const sub = conn
      .subscriptionBuilder()
      .onApplied((ctx) => {
        const roomList: Room[] = [];
        for (const row of ctx.db.room.iter()) {
          roomList.push(row);
        }
        setRooms(roomList);
      })
      .subscribe([
        'SELECT * FROM Room',
        'SELECT * FROM RoomPlayer',
        'SELECT * FROM Guess',
      ]);

    return () => sub.unsubscribe();
  }, [conn]);

  useEffect(() => {
    if (!conn || !currentRoom) return;

    const roomPlayers: RoomPlayer[] = [];
    for (const row of conn.db.room_player.iter()) {
      if (row.room_id === currentRoom.room_id) {
        roomPlayers.push(row);
      }
    }
    setPlayers(roomPlayers);

    // Actualizar estado de la sala
    for (const r of conn.db.room.iter()) {
      if (r.room_id === currentRoom.room_id) {
        setCurrentRoom(r);
        break;
      }
    }
  }, [conn, currentRoom, rooms]);

  const handleCreateRoom = async () => {
    if (!conn || !playerName.trim()) {
      setError('Ingresa tu nombre');
      return;
    }
    const num = parseInt(secretNumber, 10);
    if (isNaN(num) || num < 1 || num > 100) {
      setError('El número debe estar entre 1 y 100');
      return;
    }
    try {
      await conn.reducers.createRoom({ secret_number: num, player_name: playerName.trim() });
      setError('');
      setView('lobby');
      // Buscar la sala creada (host = identity)
      setTimeout(() => {
        for (const r of conn.db.room.iter()) {
          if (r.host.equals(identity!)) {
            setCurrentRoom(r);
            setView('game');
            break;
          }
        }
      }, 500);
    } catch (e: unknown) {
      setError(String(e));
    }
  };

  const handleJoinRoom = async () => {
    if (!conn || !playerName.trim()) {
      setError('Ingresa tu nombre');
      return;
    }
    const roomId = parseInt(joinRoomId, 10);
    if (isNaN(roomId)) {
      setError('ID de sala inválido');
      return;
    }
    try {
      await conn.reducers.joinRoom({ room_id: roomId, player_name: playerName.trim() });
      setError('');
      for (const r of conn.db.room.iter()) {
        if (r.room_id === roomId) {
          setCurrentRoom(r);
          setView('game');
          break;
        }
      }
    } catch (e: unknown) {
      setError(String(e));
    }
  };

  const handleGuess = async () => {
    if (!conn || !currentRoom) return;
    const num = parseInt(guess, 10);
    if (isNaN(num) || num < 1 || num > 100) {
      setError('El número debe estar entre 1 y 100');
      return;
    }
    try {
      await conn.reducers.guessNumber({ room_id: currentRoom.room_id, guess: num });
      setGuess('');
      setError('');
    } catch (e: unknown) {
      setError(String(e));
    }
  };

  const handleLeaveRoom = async () => {
    if (!conn || !currentRoom) return;
    try {
      await conn.reducers.leaveRoom({ room_id: currentRoom.room_id });
      setCurrentRoom(null);
      setView('lobby');
      setError('');
    } catch (e: unknown) {
      setError(String(e));
    }
  };

  const isHost = currentRoom && identity && currentRoom.host.equals(identity);

  if (!conn) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Conectando a SpacetimeDB...</h1>
        {error && <p style={{ color: '#ff6b6b' }}>{error}</p>}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        Adivina el Número
      </h1>

      {error && (
        <div style={{ background: '#ff6b6b22', padding: '0.5rem 1rem', borderRadius: 8, marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {view === 'lobby' && (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <label>Tu nombre: </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Jugador"
              style={{ padding: '0.5rem', marginLeft: '0.5rem', borderRadius: 4 }}
            />
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button onClick={() => setView('create')} style={btnStyle}>
              Crear sala
            </button>
            <button onClick={() => setView('join')} style={btnStyle}>
              Unirse a sala
            </button>
          </div>
          <h3 style={{ marginTop: '2rem' }}>Salas disponibles</h3>
          {rooms.filter((r) => r.status !== 'Finished').length === 0 ? (
            <p>No hay salas activas. ¡Crea una!</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {rooms
                .filter((r) => r.status !== 'Finished')
                .map((r) => (
                  <li key={r.room_id} style={{ marginBottom: '0.5rem' }}>
                    Sala #{r.room_id} - {r.status} -{' '}
                    <button
                      onClick={() => {
                        setJoinRoomId(String(r.room_id));
                        setView('join');
                      }}
                      style={btnStyle}
                    >
                      Unirse
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </>
      )}

      {view === 'create' && (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <label>Tu nombre: </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              style={{ padding: '0.5rem', marginLeft: '0.5rem', borderRadius: 4 }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label>Número secreto (1-100): </label>
            <input
              type="number"
              min={1}
              max={100}
              value={secretNumber}
              onChange={(e) => setSecretNumber(e.target.value)}
              style={{ padding: '0.5rem', marginLeft: '0.5rem', borderRadius: 4, width: 80 }}
            />
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={handleCreateRoom} style={btnStyle}>
              Crear sala
            </button>
            <button onClick={() => setView('lobby')} style={btnStyle}>
              Cancelar
            </button>
          </div>
        </>
      )}

      {view === 'join' && (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <label>Tu nombre: </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              style={{ padding: '0.5rem', marginLeft: '0.5rem', borderRadius: 4 }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label>ID de sala: </label>
            <input
              type="number"
              value={joinRoomId}
              onChange={(e) => setJoinRoomId(e.target.value)}
              style={{ padding: '0.5rem', marginLeft: '0.5rem', borderRadius: 4, width: 80 }}
            />
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={handleJoinRoom} style={btnStyle}>
              Unirse
            </button>
            <button onClick={() => setView('lobby')} style={btnStyle}>
              Cancelar
            </button>
          </div>
        </>
      )}

      {view === 'game' && currentRoom && (
        <>
          <div style={{ marginBottom: '1rem', padding: '1rem', background: '#ffffff11', borderRadius: 8 }}>
            <strong>Sala #{currentRoom.room_id}</strong> - Estado: {currentRoom.status}
            {isHost && ' (Eres el host)'}
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <strong>Jugadores:</strong>
            <ul>
              {players.map((p) => (
                <li key={p.id}>
                  {p.player_name}
                  {currentRoom.winner && p.identity.equals(currentRoom.winner) && ' ¡Ganador!'}
                </li>
              ))}
            </ul>
          </div>
          {currentRoom.status === 'Finished' ? (
            <p>
              {currentRoom.winner && identity && currentRoom.winner.equals(identity)
                ? '¡Ganaste!'
                : 'El juego terminó.'}
            </p>
          ) : currentRoom.status === 'Playing' && !isHost ? (
            <div style={{ marginBottom: '1rem' }}>
              <label>Adivina (1-100): </label>
              <input
                type="number"
                min={1}
                max={100}
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                style={{ padding: '0.5rem', marginLeft: '0.5rem', borderRadius: 4, width: 80 }}
              />
              <button onClick={handleGuess} style={{ ...btnStyle, marginLeft: '0.5rem' }}>
                Adivinar
              </button>
            </div>
          ) : currentRoom.status === 'Waiting' ? (
            <p>Esperando más jugadores...</p>
          ) : null}
          <button onClick={handleLeaveRoom} style={{ ...btnStyle, marginTop: '1rem' }}>
            Salir de la sala
          </button>
        </>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  borderRadius: 8,
  border: 'none',
  background: '#4361ee',
  color: 'white',
  cursor: 'pointer',
};

export default App;
