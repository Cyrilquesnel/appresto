#!/usr/bin/env node
// scripts/check-env.js
// Vérifie que toutes les variables d'environnement requises sont définies.
// Utilisé en CI (deploy-prod.yml) avant de déployer en production.
// Usage : node scripts/check-env.js

const REQUIRED = [
  // Supabase
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',

  // IA
  'GEMINI_API_KEY',
  'ANTHROPIC_API_KEY',

  // Rate limiting
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',

  // Email
  'RESEND_API_KEY',

  // Push notifications
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY',

  // Monitoring
  'NEXT_PUBLIC_SENTRY_DSN',
  'SENTRY_DSN',
  'SENTRY_AUTH_TOKEN',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
  'NEXT_PUBLIC_POSTHOG_KEY',

  // Application
  'NEXT_PUBLIC_APP_URL',
  'CRON_SECRET',
]

// Optionnelles mais on les signale si absentes
const OPTIONAL = [
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'BETTERUPTIME_HEARTBEAT_RAPPELCONSO',
  'BETTERUPTIME_HEARTBEAT_TEMPERATURES',
  'BETTERUPTIME_HEARTBEAT_ONBOARDING',
]

const missing = REQUIRED.filter((key) => !process.env[key])
const missingOptional = OPTIONAL.filter((key) => !process.env[key])

if (missingOptional.length > 0) {
  console.warn('⚠️  Variables optionnelles manquantes (features dégradées) :')
  missingOptional.forEach((key) => console.warn(`   - ${key}`))
}

if (missing.length > 0) {
  console.error('\n❌ Variables requises manquantes :')
  missing.forEach((key) => console.error(`   - ${key}`))
  console.error(`\n${missing.length} variable(s) requise(s) non définie(s). Déploiement annulé.\n`)
  process.exit(1)
}

console.log(`✅ Toutes les variables requises sont définies (${REQUIRED.length} vérifiées)\n`)
