# Juego Multijugador - Adivina el Número (SpacetimeDB 2.0)

Juego multijugador en tiempo real construido con **SpacetimeDB 2.0**. Un jugador crea una sala con un número secreto (1-100), otros se unen e intentan adivinarlo. El primero en acertar gana.

## Estructura del Proyecto

- `spacetimedb/` - Módulo Rust (backend) con tablas y reducers
- `client/` - Frontend React + TypeScript
- `SPACETIMEDB_IMPLEMENTACION.md` - Documentación detallada de la implementación

## Requisitos

- Rust 1.93+
- Node.js 18+
- SpacetimeDB CLI (opcional, para publicar) o Docker

## Desarrollo

1. **Iniciar SpacetimeDB** (Docker):
   ```bash
   docker run --rm -p 3000:3000 clockworklabs/spacetime start
   ```

2. **Publicar el módulo** (con SpacetimeDB CLI):
   ```bash
   cd spacetimedb && spacetime publish
   ```

3. **Instalar dependencias y ejecutar el cliente**:
   ```bash
   npm install
   npm run dev
   ```

## Documentación

Ver `SPACETIMEDB_IMPLEMENTACION.md` para:
- Cómo está implementado SpacetimeDB en la aplicación
- Qué partes abstrae (red, persistencia, sincronización, etc.)
- Flujo de datos y arquitectura
