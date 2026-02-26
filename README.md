# Juego Multijugador - Adivina el Número (SpacetimeDB 2.0)

Juego multijugador en tiempo real construido con **SpacetimeDB 2.0**. Un jugador crea una sala con un número secreto (1-100), otros se unen e intentan adivinarlo. El primero en acertar gana.

## Estructura del Proyecto

- `spacetimedb/` - Módulo **TypeScript** (backend) con tablas y reducers
- `client/` - Frontend React + TypeScript
- `SPACETIMEDB_IMPLEMENTACION.md` - Detalle técnico de SpacetimeDB
- `DESARROLLO.md` - Cómo se desarrolló y rol de SpacetimeDB

## Requisitos

- Node.js 18+
- SpacetimeDB CLI (para publicar) o Docker

## Desarrollo

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

3. **Instalar dependencias y ejecutar el cliente**:
   ```bash
   npm install
   npm run dev
   ```

## Despliegue en GitHub Pages

El frontend se despliega automáticamente en GitHub Pages al hacer push a `main` o `develop`.

### Configuración inicial (una vez)

1. En el repo: **Settings → Pages**
2. En "Build and deployment", elegir **GitHub Actions** como fuente

### URL

- Por defecto: `https://rodrigoromero2308.github.io/spacetimedb-test`
- Dominio custom: configurable en Settings → Pages → Custom domain

### Despliegue manual

```bash
npm run deploy
```

### Variables de entorno (Maincloud)

El workflow usa Maincloud por defecto. Para cambiar, añade secrets en **Settings → Secrets and variables → Actions**:
- `VITE_SPACETIMEDB_URI`
- `VITE_SPACETIMEDB_DB`

## Documentación

Ver `SPACETIMEDB_IMPLEMENTACION.md` para:
- Cómo está implementado SpacetimeDB en la aplicación
- Qué partes abstrae (red, persistencia, sincronización, etc.)
- Flujo de datos y arquitectura
