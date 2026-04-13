# Task 1.1: Initialisation Projet Next.js 14

## Objective
Créer le projet Next.js 14 App Router avec toutes les dépendances, Tailwind CSS v4, structure de dossiers conforme à l'architecture, et configuration de base (ESLint, Prettier, TypeScript strict).

## Context
Point de départ absolu du projet. Rien n'existe encore. Toutes les autres tâches dépendent de cette initialisation. Le projet doit être mobile-first, PWA-ready, et respecter la structure définie dans `mise-en-place-architecture`.

## Dependencies
- Aucune

## Blocked By
- Rien

## Implementation Plan

### Step 1: Créer le projet Next.js 14

```bash
cd "/Users/cyril/APP RESTO"
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm
```

Répondre : No à tout ce qui est optionnel sauf TypeScript, ESLint, Tailwind, App Router.

### Step 2: Installer toutes les dépendances

```bash
npm install @ducanh2912/next-pwa
npm install @trpc/server@11 @trpc/client@11 @trpc/react-query@11 @trpc/next@11
npm install @tanstack/react-query@5
npm install zustand@5
npm install @supabase/supabase-js @supabase/ssr
npm install zod superjson
npm install @google/generative-ai
npm install @anthropic-ai/sdk
npm install @upstash/ratelimit @upstash/redis
npm install resend
npm install web-push
npm install @react-pdf/renderer
npm install posthog-node
npm install @sentry/nextjs

npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths jsdom @testing-library/react @testing-library/jest-dom
npm install -D @playwright/test
npm install -D prettier eslint-config-prettier
npm install -D @types/web-push
```

### Step 3: Structure de dossiers

Créer la structure suivante (dossiers vides avec .gitkeep si nécessaire) :

```
app/
  (auth)/
    login/
    register/
  (app)/
    dashboard/
    plats/
    commandes/
    mercuriale/
    pms/
    onboarding/
    settings/
  api/
    trpc/[trpc]/
    analyze-dish/
    process-invoice/
    generate-pdf/
    push/subscribe/
    cron/
      rappelconso/
      temperature-reminders/
      onboarding-notifications/
    health/
server/
  routers/
lib/
  supabase/
  ai/
  trpc/
components/
  ui/
  dishes/
  mercuriale/
  commandes/
  dashboard/
  pms/
  pdf/
  onboarding/
stores/
hooks/
types/
tests/
  unit/
  e2e/
  fixtures/
  mocks/
public/
  icons/
  screenshots/
supabase/
  migrations/
  functions/
  tests/
scripts/
```

```bash
mkdir -p app/\(auth\)/login app/\(auth\)/register app/\(app\)/dashboard app/\(app\)/plats app/\(app\)/commandes app/\(app\)/mercuriale app/\(app\)/pms app/\(app\)/onboarding app/\(app\)/settings
mkdir -p app/api/trpc/\[trpc\] app/api/analyze-dish app/api/process-invoice app/api/generate-pdf app/api/push/subscribe app/api/cron/rappelconso app/api/cron/temperature-reminders app/api/cron/onboarding-notifications app/api/health
mkdir -p server/routers lib/supabase lib/ai lib/trpc
mkdir -p components/ui components/dishes components/mercuriale components/commandes components/dashboard components/pms components/pdf components/onboarding
mkdir -p stores hooks types
mkdir -p tests/unit tests/e2e tests/fixtures tests/mocks
mkdir -p public/icons public/screenshots
mkdir -p supabase/migrations supabase/functions supabase/tests
mkdir -p scripts
```

### Step 4: Configurer next.config.ts

```typescript
// next.config.ts
import withPWA from "@ducanh2912/next-pwa";

const nextConfig = withPWA({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  }
})({
  experimental: {
    serverActions: { allowedOrigins: ["localhost:3000"] }
  }
});

export default nextConfig;
```

### Step 5: Configurer Tailwind CSS v4 + Design Tokens

```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  --color-primary: #1a1a2e;
  --color-primary-light: #16213e;
  --color-accent: #e94560;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
  --spacing-safe-bottom: env(safe-area-inset-bottom);
  --spacing-safe-top: env(safe-area-inset-top);
}

.h-screen-safe {
  height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom));
}
```

### Step 6: Layout principal avec meta iOS

```tsx
// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mise en Place',
  description: 'Le copilote du restaurateur indépendant',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Mise en Place',
  },
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
```

### Step 7: Manifest PWA

```json
// public/manifest.json
{
  "name": "Mise en Place",
  "short_name": "Mise en Place",
  "description": "Le copilote du restaurateur indépendant",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1a1a2e",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

Créer des icônes placeholder (PNG simple coloré) dans `public/icons/` :
```bash
# Créer icônes placeholder avec ImageMagick si disponible, sinon créer fichiers vides de 1px
convert -size 192x192 xc:#1a1a2e public/icons/icon-192.png 2>/dev/null || echo "ImageMagick non dispo — créer manuellement"
```

### Step 8: Configurer ESLint + Prettier

```json
// .prettierrc
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

```json
// .eslintrc.json
{
  "extends": ["next/core-web-vitals", "prettier"],
  "rules": {
    "no-unused-vars": "warn",
    "@typescript-eslint/no-explicit-any": "warn"
  }
}
```

### Step 9: Configurer Vitest

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  }
})
```

```typescript
// tests/setup.ts
import '@testing-library/jest-dom'
```

### Step 10: Scripts package.json

Ajouter dans `package.json` :
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test:e2e": "playwright test",
    "test:all": "npm run typecheck && npm run lint && npm run test:unit"
  }
}
```

### Step 11: .env.example

```bash
# .env.example
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_URL=

# AI
GEMINI_API_KEY=
ANTHROPIC_API_KEY=

# Rate limiting
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Email
RESEND_API_KEY=

# Push notifications
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# WhatsApp
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=

# Monitoring
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_DSN=
SENTRY_AUTH_TOKEN=
BETTERUPTIME_HEARTBEAT_URL=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=
REQUIRE_PAYMENT_METHOD=false
```

### Step 12: Page d'accueil minimale

```tsx
// app/page.tsx
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold text-primary">Mise en Place</h1>
      <p className="mt-2 text-gray-600">Le copilote du restaurateur indépendant</p>
    </main>
  )
}
```

### Step 13: Playwright config

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'iPhone 14 Safari', use: { ...devices['iPhone 14'], browserName: 'webkit' } },
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
  ]
})
```

### Step 14: .gitignore

S'assurer que `.gitignore` contient :
```
.env*.local
.env.local
.env.production
node_modules/
.next/
```

## Files to Create

- `next.config.ts`
- `app/layout.tsx`
- `app/globals.css`
- `app/page.tsx`
- `public/manifest.json`
- `public/icons/icon-192.png` (placeholder)
- `public/icons/icon-512.png` (placeholder)
- `.env.example`
- `.prettierrc`
- `vitest.config.ts`
- `tests/setup.ts`
- `playwright.config.ts`
- Structure de dossiers complète

## Files to Modify

- `package.json` — ajouter scripts test:unit, typecheck, format
- `.eslintrc.json` — ajouter prettier
- `tsconfig.json` — vérifier strict: true

## Contracts

### Provides (pour tâches suivantes)
- Structure de dossiers complète
- Dépendances npm installées
- `npm run dev` fonctionnel sur localhost:3000
- `npm run build` produit un build valide
- Design tokens Tailwind: `--color-primary`, `--color-accent`, `--color-success`, `--color-warning`, `--color-danger`

## Acceptance Criteria

- [ ] `npm run dev` démarre sans erreurs sur localhost:3000
- [ ] `npm run build` passe sans erreurs
- [ ] `npm run typecheck` → 0 erreur TypeScript
- [ ] `npm run lint` → 0 erreur ESLint
- [ ] `npm run test:unit` → 0 test échoué (ou 0 test = pas de tests encore)
- [ ] Page d'accueil affiche "Mise en Place" sur localhost:3000
- [ ] Structure de dossiers conforme (tous les dossiers créés)
- [ ] `.env.example` contient toutes les variables

## Testing Protocol

### Build/Lint/Type Checks
- [ ] `npm run typecheck` passe
- [ ] `npm run lint` passe
- [ ] `npm run build` passe

### Browser Testing (Playwright MCP)
- Démarrer : `npm run dev`
- Naviguer vers : http://localhost:3000
- Vérifier : "Mise en Place" visible dans la page
- Vérifier manifest : http://localhost:3000/manifest.json retourne JSON valide

## Skills to Read

- `mise-en-place-architecture` — structure dossiers, conventions nommage
- `nextjs-pwa-mobile` — config PWA, meta iOS

## Research Files to Read

- `.claude/orchestration-mise-en-place/research/next-js-pwa-supabase.md` — config Next.js + PWA

## Git

- Branch: `phase-1/foundation`
- Commit message prefix: `Task 1.1:`

## PROGRESS.md Update

Une fois terminé, mettre à jour `/Users/cyril/APP RESTO/.claude/orchestration-mise-en-place/PROGRESS.md` :
- Marquer Task 1.1 comme ✅ completed
- Noter la date et tout problème rencontré
