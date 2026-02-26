# Desarrollo del Juego Multijugador - Adivina el Número

## Resumen

Este documento describe **cómo se desarrolló** el juego y el **rol de SpacetimeDB** en la arquitectura. El backend está implementado en **TypeScript** (migrado desde Rust) para facilitar el desarrollo con un stack familiar (Node/JavaScript).

---

## 1. Rol de SpacetimeDB en la Aplicación

SpacetimeDB actúa como **backend unificado** que combina:

| Función tradicional | Cómo lo resuelve SpacetimeDB |
|---------------------|------------------------------|
| Base de datos       | Tablas en memoria con persistencia automática |
| API REST/GraphQL    | Reducers invocables por el cliente vía WebSocket |
| Servidor de juego   | Lógica de negocio en el módulo (TypeScript) |
| Sincronización real-time | Replicación automática a clientes suscritos |
| Autenticación       | Identity por conexión, tokens opcionales |

**No necesitas:**
- Configurar PostgreSQL, Redis, etc.
- Montar un servidor HTTP/WebSocket propio
- Implementar lógica de sincronización
- Gestionar migraciones de esquema manualmente (en muchos casos)

---

## 2. Proceso de Desarrollo

### 2.1 Diseño del Juego

Se eligió **"Adivina el número"** por ser:
- Simple de implementar
- Adecuado para demostrar salas y multijugador
- Fácil de probar con 2+ jugadores

**Reglas:**
1. Un jugador crea una sala con un número secreto (1-100)
2. Otros jugadores se unen por ID de sala
3. Cuando hay ≥2 jugadores, el juego pasa a "Playing"
4. Los jugadores (excepto el host) intentan adivinar
5. El primero en acertar gana

### 2.2 Modelo de Datos

```
Room         → Salas (room_id, host, secret_number, status, winner)
RoomPlayer   → Jugadores en cada sala
Guess        → Intentos de adivinar
RoomCounter  → Contador para IDs de sala (evita colisiones)
```

### 2.3 Reducers (Lógica de Servidor)

| Reducer       | Propósito |
|---------------|-----------|
| `init`        | Inicializar RoomCounter (fallback manual) |
| `create_room` | Crear sala y unir al host |
| `join_room`   | Unir jugador a sala existente |
| `guess_number`| Registrar intento y detectar ganador |
| `leave_room`  | Abandonar sala |

### 2.4 Migración de Rust a TypeScript

**Motivación:** El desarrollador prefiere Node/Python; Rust se aprenderá más adelante.

**Cambios realizados:**
- Reemplazo de `spacetimedb/src/lib.rs` por `spacetimedb/src/index.ts`
- Misma API conceptual: `schema`, `table`, `reducer`, `ctx.db`, `ctx.sender`
- Errores con `SenderError` en lugar de `Result<(), String>`
- Tipos: `bigint` para u64, `Identity` para identidad

**Ventajas de TypeScript:**
- Mismo lenguaje que el cliente (menos contexto que cambiar)
- Desarrollo más rápido para prototipos
- Depuración más sencilla

---

## 3. Estructura del Proyecto

```
workspace/
├── spacetimedb/           # Módulo backend (TypeScript)
│   ├── src/index.ts      # Tablas, reducers, init
│   ├── package.json
│   └── tsconfig.json
├── client/               # Frontend React
│   └── src/
│       ├── App.tsx       # UI del juego
│       ├── main.tsx
│       └── module_bindings/  # Tipos y API generados manualmente
├── SPACETIMEDB_IMPLEMENTACION.md  # Detalle técnico de SpacetimeDB
└── DESARROLLO.md         # Este documento
```

---

## 4. Flujo de una Partida

1. **Cliente A** llama `createRoom({ secret_number: 42, player_name: "Alice" })`
2. **SpacetimeDB** ejecuta el reducer, inserta en `Room` y `RoomPlayer`
3. **Cliente A** recibe la actualización por subscripción, ve la sala creada
4. **Cliente B** llama `joinRoom({ room_id: 1, player_name: "Bob" })`
5. Con 2 jugadores, el reducer actualiza `Room.status` a "Playing"
6. **Cliente B** llama `guessNumber({ room_id: 1, guess: 42 })`
7. El reducer detecta acierto, actualiza `Room.status` a "Finished" y `Room.winner`
8. Ambos clientes ven el resultado en tiempo real

---

## 5. Cómo Ejecutar

### Requisitos
- Node.js 18+
- SpacetimeDB CLI (para publicar) o Docker

### Pasos

1. **Iniciar SpacetimeDB** (Docker):
   ```bash
   docker run --rm -p 3000:3000 clockworklabs/spacetime start
   ```

2. **Publicar el módulo** (con SpacetimeDB CLI):
   ```bash
   cd spacetimedb
   spacetime login
   spacetime publish juego-multijugador
   ```

3. **Cliente**:
   ```bash
   npm install
   npm run dev
   ```

4. Configurar `VITE_SPACETIMEDB_URI` y `VITE_SPACETIMEDB_DB` si usas otro host/nombre.

---

## 6. Decisiones de Diseño

- **Module bindings manuales:** Sin CLI instalada, los bindings se definen a mano en `client/src/module_bindings/`. Con `spacetime generate --lang typescript` se pueden regenerar.
- **Init automático y manual:** `spacetimedb.init()` corre al publicar; el reducer `init` permite inicializar manualmente si la BD ya existía.
- **Sin autenticación JWT:** Se usa Identity anónimo por conexión. Para producción, SpacetimeAuth permite login con proveedores OIDC.

---

## 7. Referencias

- [SpacetimeDB Docs](https://spacetimedb.com/docs/)
- [TypeScript Module Reference](https://spacetimedb.com/docs/modules/typescript)
- [SPACETIMEDB_IMPLEMENTACION.md](./SPACETIMEDB_IMPLEMENTACION.md) — Detalle técnico de la implementación
