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

## Workflows de despliegue (rama `main`)

Hay 2 workflows que se ejecutan **solo en la rama `main`** y **solo cuando hay cambios** en sus respectivos proyectos:

| Workflow | Se ejecuta cuando cambia | Acción |
|----------|---------------------------|--------|
| **Deploy to GitHub Pages** | `client/`, `index.html`, `vite.config.ts`, `package.json` | Publica el frontend en GitHub Pages |
| **Deploy to SpacetimeDB Maincloud** | `spacetimedb/` | Publica el módulo en Maincloud |

### GitHub Pages

1. **Settings → Pages** → elegir **GitHub Actions** como fuente
2. URL: `https://rodrigoromero2308.github.io/spacetimedb-test`
3. Despliegue manual: `npm run deploy`

### Maincloud (SpacetimeDB)

Para que el workflow publique automáticamente, configura el secret **SPACETIMEDB_CREDENTIALS**:

1. Ejecuta `spacetime login` localmente (abre el navegador)
2. Crea el secret (Linux/Mac):
   ```bash
   cd ~ && tar czf - .spacetimedb | base64
   ```
   Copia toda la salida (puede ser multilínea).
3. En **Settings → Secrets and variables → Actions**, crea `SPACETIMEDB_CREDENTIALS` y pega el valor.

Sin este secret, el workflow fallará al publicar. También puedes ejecutar **Actions → Deploy to SpacetimeDB Maincloud → Run workflow** para lanzarlo manualmente.

## Documentación

Ver `SPACETIMEDB_IMPLEMENTACION.md` para:
- Cómo está implementado SpacetimeDB en la aplicación
- Qué partes abstrae (red, persistencia, sincronización, etc.)
- Flujo de datos y arquitectura
