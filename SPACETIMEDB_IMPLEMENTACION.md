# Implementación de SpacetimeDB 2.0 en el Juego Multijugador

## Resumen

Este documento describe cómo está implementado **SpacetimeDB 2.0** en la aplicación de juego multijugador "Adivina el Número", qué partes abstrae y cómo se integra en la arquitectura.

---

## 1. ¿Qué es SpacetimeDB?

SpacetimeDB es una base de datos en tiempo real que combina:

- **Almacenamiento persistente** en memoria con replicación automática
- **Lógica de servidor** ejecutada como WebAssembly (módulos Rust)
- **Sincronización en tiempo real** con clientes vía WebSocket
- **Modelo transaccional** donde los "reducers" son la única forma de modificar datos

---

## 2. Arquitectura de la Aplicación

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│   Cliente       │ ◄────────────────► │   SpacetimeDB    │
│   (React/TS)    │                    │   (Servidor)     │
└─────────────────┘                    └────────┬─────────┘
        │                                       │
        │ subscribe / call reducers              │ ejecuta reducers
        │                                       │
        ▼                                       ▼
┌─────────────────┐                    ┌──────────────────┐
│ module_bindings │                    │ Módulo Rust      │
│ (tipos + API)   │                    │ (wasm32-wasi)    │
└─────────────────┘                    └──────────────────┘
```

---

## 3. Partes que SpacetimeDB Abstrae

### 3.1 Infraestructura de Red y Conectividad

**Qué abstrae:**
- Conexión WebSocket persistente
- Reconexión automática
- Serialización/deserialización binaria del protocolo
- Compresión (opcional)

**Qué no tienes que hacer:**
- Gestionar conexiones manualmente
- Implementar protocolos de sincronización
- Manejar reconexiones o heartbeats

### 3.2 Sincronización de Estado en Tiempo Real

**Qué abstrae:**
- Replicación de datos desde el servidor al cliente
- Caché local que se actualiza automáticamente
- Subscripciones por consulta SQL (ej: `SELECT * FROM Room`)
- Callbacks para inserciones, actualizaciones y borrados

**Qué no tienes que hacer:**
- Implementar lógica de diff/patch
- Gestionar conflictos de concurrencia en el cliente
- Polling o long-polling

### 3.3 Persistencia y Transacciones

**Qué abstrae:**
- Persistencia a disco
- Transacciones ACID
- Rollback automático si un reducer falla

**Qué no tienes que hacer:**
- Configurar bases de datos SQL/NoSQL
- Escribir migraciones manuales
- Gestionar conexiones a BD

### 3.4 Autenticación e Identidad

**Qué abstrae:**
- Identidad única por cliente (`Identity`)
- Tokens de autenticación (opcional, SpacetimeAuth)
- `ctx.sender()` en reducers para saber quién llamó

**Qué no tienes que hacer:**
- Implementar login/session
- Gestionar JWT u OAuth (a menos que uses SpacetimeAuth)

### 3.5 Lógica de Servidor (Backend)

**Qué abstrae:**
- Ejecución de lógica en el servidor (reducers)
- Aislamiento (sin filesystem, sin red arbitraria)
- Entorno determinista

**Qué no tienes que hacer:**
- Montar un servidor HTTP/WebSocket propio
- Escalar horizontalmente la lógica de juego
- Proteger contra trampas (la lógica corre en el servidor)

---

## 4. Implementación en Este Proyecto

### 4.1 Módulo Rust (Backend)

**Ubicación:** `spacetimedb/src/lib.rs`

**Tablas:**

| Tabla        | Descripción                                      |
|--------------|--------------------------------------------------|
| `Room`       | Salas de juego (host, número secreto, estado)    |
| `RoomPlayer` | Jugadores en cada sala                           |
| `Guess`      | Intentos de adivinar                             |
| `RoomCounter`| Contador para IDs de sala auto-incrementados     |

**Reducers:**

| Reducer        | Parámetros                    | Descripción                    |
|----------------|-------------------------------|--------------------------------|
| `init`         | -                             | Inicializa el sistema          |
| `create_room`  | secret_number, player_name    | Crea una sala                  |
| `join_room`    | room_id, player_name          | Une a un jugador a una sala    |
| `guess_number` | room_id, guess                | Intento de adivinar            |
| `leave_room`   | room_id                       | Abandona una sala              |

**API de SpacetimeDB usada:**
- `#[spacetimedb::table(accessor = nombre)]` para tablas
- `#[spacetimedb::reducer]` para funciones invocables
- `ReducerContext` con `ctx.db`, `ctx.sender()`, `ctx.timestamp`
- `Table` trait: `iter()`, `insert()`, `delete()`
- Accesores por clave única: `ctx.db.room().room_id().update(row)`, `ctx.db.room_player().id().delete(id)`

### 4.2 Cliente TypeScript (Frontend)

**Ubicación:** `client/src/`

**Module bindings:** `client/src/module_bindings/index.ts`

Define manualmente:
- Esquema de tablas (`schema`, `table`, `t`)
- Esquema de reducers (`reducerSchema`, `reducers`)
- `DbConnection` tipado
- Tipos `Room`, `RoomPlayer`, `Guess`, `RoomCounter`

**Flujo de conexión:**
1. `DbConnection.builder().withUri(...).withDatabaseName(...).build()`
2. En `onConnect`, crear subscripción con `subscriptionBuilder().subscribe([...]).onApplied(...)`
3. Leer datos con `ctx.db.room.iter()`, `ctx.db.room_player.iter()`, etc.
4. Llamar reducers con `conn.reducers.createRoom(...)`, `conn.reducers.guessNumber(...)`, etc.

**Subscripciones:**
```typescript
conn.subscriptionBuilder()
  .onApplied((ctx) => {
    for (const row of ctx.db.room.iter()) { ... }
  })
  .subscribe([
    'SELECT * FROM Room',
    'SELECT * FROM RoomPlayer',
    'SELECT * FROM Guess',
  ]);
```

---

## 5. Flujo de Datos

1. **Cliente llama reducer** → `conn.reducers.createRoom({ secret_number: 42, player_name: 'Alice' })`
2. **SpacetimeDB** recibe la llamada, ejecuta el reducer en una transacción
3. **Reducer** inserta en `Room` y `RoomPlayer`
4. **SpacetimeDB** confirma la transacción y difunde los cambios a los clientes suscritos
5. **Cliente** recibe actualizaciones, su caché local se actualiza
6. **Callbacks** `onInsert`/`onUpdate`/`onDelete` (si se registraron) se ejecutan

---

## 6. Limitaciones y Consideraciones

- **Reducers no devuelven valores** (solo `Result<(), E>`): el cliente debe inferir el resultado vía subscripciones (ej: nueva fila en `Room`).
- **Sin callbacks globales de reducer en 2.0**: se usan tablas de eventos o callbacks por llamada `_then()`.
- **Module bindings**: normalmente se generan con `spacetime generate --lang typescript`; aquí se definen manualmente por no tener la CLI instalada.
- **Target WASM**: el módulo Rust debe compilar para `wasm32-wasi` (o el target que use SpacetimeDB) para desplegarse.

---

## 7. Cómo Ejecutar

### Requisitos
- Rust (1.93+)
- Node.js 18+
- SpacetimeDB CLI (para publicar) o Docker para servidor local

### Desarrollo local

1. **Iniciar SpacetimeDB** (Docker):
   ```bash
   docker run --rm -p 3000:3000 clockworklabs/spacetime start
   ```

2. **Publicar el módulo** (con CLI):
   ```bash
   cd spacetimedb && spacetime publish
   ```

3. **Iniciar el cliente**:
   ```bash
   npm run dev
   ```

4. **Inicializar la base** (primera vez): llamar al reducer `init` desde la consola o la UI.

---

## 8. Resumen de Abstracciones

| Capa                    | SpacetimeDB abstrae                         | Tú implementas                    |
|-------------------------|---------------------------------------------|-----------------------------------|
| Red                     | WebSocket, protocolo, reconexión           | URI y nombre de BD                |
| Estado                  | Replicación, caché, subscripciones          | Consultas SQL y callbacks         |
| Persistencia            | Transacciones, almacenamiento               | Esquema (tablas, columnas)        |
| Lógica de servidor      | Ejecución de reducers, aislamiento          | Reducers en Rust                  |
| Autenticación           | Identity, tokens                            | Uso de `ctx.sender()`             |
| Tipado cliente-servidor | Serialización, tipos compartidos            | Module bindings (manual o generado) |

---

*Documento generado para el proyecto juego-multijugador con SpacetimeDB 2.0.*
