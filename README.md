# Ofibites Backend

API B2B de aprovisionamiento corporativo (coffee break, working lunch, etc.) para oficinas. Construido con [NestJS](https://nestjs.com/) 11, Prisma 6 y Supabase.

## Stack

- **NestJS 11** — framework HTTP.
- **Prisma 6** — ORM contra PostgreSQL (Supabase).
- **Supabase Auth** — identidad (JWT bearer).
- **Supabase Storage** — archivos (imágenes de productos, comprobantes, etc.).
- **class-validator** + **class-transformer** — validación de DTOs.
- **Swagger** — documentación de API en `/api/docs`.

Más detalle de arquitectura, capas, wiring y guards en `CLAUDE.md`. El plan de evolución del producto está en `docs/`.

## Setup

```bash
yarn install
```

Variables de entorno requeridas (crear `.env` en la raíz):

```
DATABASE_URL=postgresql://...      # connection pooler de Supabase
DIRECT_URL=postgresql://...        # conexión directa (para migraciones)
SUPABASE_URL=https://....supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
# Secreto JWT legacy (HS256) de Supabase (Settings > API > JWT Secret). Con él, JwtAuthGuard verifica los tokens HS256
# en local; sin él los valida con auth.getUser() (un viaje a Supabase por request). Los tokens RS256/ES256 usan el JWKS.
SUPABASE_JWT_SECRET=...
# URL del front a la que lleva el correo de "olvidé mi contraseña" (p. ej. http://localhost:3001/reset-password).
# Debe estar en la allow-list de Redirect URLs de Supabase Auth; si falta, Supabase usa su Site URL.
SUPABASE_RECOVERY_REDIRECT_URL=http://localhost:3001/reset-password
PORT=3000
# Saltos de proxy de confianza (Express "trust proxy") para que la limitación por IP vea la IP real.
# 0 o sin definir en local; 1 en producción detrás de un proxy/PaaS.
TRUST_PROXY_HOPS=0
NODE_ENV=development
# CORS_ORIGIN=https://ofibites.com,https://ofibites-front.vercel.app  # solo en producción; varios orígenes separados por coma
```

## Comandos

```bash
yarn start:dev         # nest start --watch (regenera Prisma client primero)
yarn build             # compila a dist/
yarn lint              # eslint --fix
yarn format            # prettier write
yarn test              # jest unit
yarn test:watch
yarn test:e2e          # jest e2e (test/jest-e2e.json)

# correr un solo test
yarn test path/to/file.spec.ts
yarn test -t "nombre del test"

# Prisma
npx prisma migrate diff --from-schema-datamodel <schema-anterior> --to-schema-datamodel prisma/schema.prisma --script  # genera el SQL de un cambio
npx prisma db execute --file prisma/migrations/<AAAAMMDD_slug>/migration.sql --schema prisma/schema.prisma  # lo aplica
npx prisma generate                    # regenera cliente
npx prisma studio                      # GUI
```

> **Migraciones sin baseline.** `prisma/migrations/` no es un historial de Prisma Migrate: la BD de Supabase nunca se baselineó y los SQL antiguos se borraron (commit fcab065). Cada cambio de schema se guarda como `prisma/migrations/<AAAAMMDD_slug>/migration.sql` (envuelto en `BEGIN; … COMMIT;`) y se aplica **a mano** con `prisma db execute` o desde el SQL editor de Supabase, antes de desplegar el código que lo usa. **Nunca** uses `prisma migrate dev` ni `prisma migrate deploy` contra esta BD: piden un reset (pérdida de datos) o fallan con P3005.

## Estructura

```
src/
├── core/
│   ├── domain/          # entidades, enums, interfaces de repositorio, servicios de dominio
│   ├── application/     # use-cases, DTOs
│   └── infrastructure/  # PrismaService, repos concretos, SupabaseService
├── modules/             # capa HTTP (controllers + module wiring por feature)
└── common/              # decorators, filters, guards, interceptors transversales
```

Swagger en runtime: `http://localhost:3000/api/docs`.
