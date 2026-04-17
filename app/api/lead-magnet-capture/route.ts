import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, prospectionTable } from '@/lib/supabase/server'
import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  let body: { email?: string; nom_restaurant?: string; ville?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  const { email, nom_restaurant, ville } = body

  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Upsert dans prospects (conflict sur email, pas sur google_place_id)
  const { error: upsertError } = await prospectionTable(supabase, 'prospects').upsert(
    {
      nom: nom_restaurant || 'Lead Magnet',
      email,
      ville: ville || null,
      source: 'lead_magnet',
      statut: 'new',
      score: 45,
    },
    { onConflict: 'email', ignoreDuplicates: false }
  )

  if (upsertError) {
    console.error('[lead-magnet-capture] Upsert error:', upsertError.message)
    // On ne bloque pas l'utilisateur pour une erreur DB
  }

  // Email de bienvenue via Resend
  if (process.env.RESEND_API_KEY) {
    const nom = nom_restaurant ? `${nom_restaurant}` : 'votre restaurant'
    const html = `
      <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;color:#05060F;">
        <div style="background:#002395;padding:28px 32px;border-radius:10px 10px 0 0;">
          <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800;letter-spacing:-0.5px;">
            <span style="color:#ED2939;">Le</span> Rush
          </h1>
          <p style="color:#94a3b8;margin:6px 0 0;font-size:13px;">La fiche technique gratuite pour ${nom}</p>
        </div>

        <div style="padding:32px;background:#fff;border:1px solid #e5e7eb;border-top:none;">
          <h2 style="font-size:18px;font-weight:700;margin:0 0 12px;">Votre fiche technique est prête !</h2>
          <p style="color:#4b5563;line-height:1.7;margin:0 0 20px;">
            Merci d'avoir testé l'analyse IA Le Rush. Votre fiche technique avec les ingrédients
            détectés, les allergènes et l'estimation du food cost a bien été générée.
          </p>

          <div style="background:#f9fafb;border-radius:8px;padding:20px;margin:0 0 24px;border-left:4px solid #ED2939;">
            <p style="margin:0;font-size:14px;font-weight:600;color:#05060F;">Accès complet à l'app Le Rush</p>
            <ul style="margin:8px 0 0;padding-left:20px;color:#4b5563;font-size:13px;line-height:1.8;">
              <li>Fiches techniques illimitées avec PDF</li>
              <li>Calcul du food cost en temps réel</li>
              <li>Relevés de températures HACCP</li>
              <li>Bons de commande fournisseurs</li>
            </ul>
          </div>

          <a href="https://lerush.app?utm_source=lead_magnet&utm_medium=email"
             style="display:inline-block;background:#ED2939;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
            Accéder à l'app gratuitement →
          </a>

          <p style="color:#9ca3af;font-size:12px;margin-top:32px;">
            Vous recevez cet email car vous avez utilisé l'outil d'analyse gratuit Le Rush.
            <br>Pour vous désinscrire, répondez "STOP" à cet email.
          </p>
        </div>

        <div style="background:#f8fafc;padding:16px 32px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;border-top:none;">
          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
            Le Rush · SAS La Fabrique Alimentaire ·
            <a href="https://lerush.app" style="color:#94a3b8;">lerush.app</a>
          </p>
        </div>
      </div>
    `

    try {
      const { error: emailError } = await getResend().emails.send({
        from: 'bonjour@lerush.app',
        to: email,
        subject: `Votre fiche technique gratuite — Le Rush`,
        html,
      })
      if (emailError) {
        console.error('[lead-magnet-capture] Email error:', emailError.message)
      }
    } catch (err) {
      console.error('[lead-magnet-capture] Resend exception:', (err as Error).message)
    }
  }

  return NextResponse.json({ success: true })
}
