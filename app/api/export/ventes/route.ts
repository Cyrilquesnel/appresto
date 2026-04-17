import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // Récupérer le restaurant de l'utilisateur
  const { data: restaurantUser } = await supabase
    .from('restaurant_users')
    .select('restaurant_id')
    .eq('user_id', user.id)
    .single()

  if (!restaurantUser) {
    return NextResponse.json({ error: 'Restaurant introuvable' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const dateDebut =
    searchParams.get('date_debut') ??
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const dateFin = searchParams.get('date_fin') ?? new Date().toISOString().split('T')[0]

  const { data: ventes, error } = await supabase
    .from('ventes')
    .select(
      'date, service, nb_couverts, panier_moyen, montant_total, mode_saisie, notes, plat:plats(nom)'
    )
    .eq('restaurant_id', restaurantUser.restaurant_id!)
    .gte('date', dateDebut)
    .lte('date', dateFin)
    .order('date', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = ventes ?? []

  const csvField = (val: string | number | null | undefined): string => {
    const s = val == null ? '' : String(val)
    // Always quote: protects commas, newlines, and double-quotes in any field
    return `"${s.replace(/"/g, '""')}"`
  }

  const header = '"Date","Service","Plat","Couverts","Panier moyen (€)","CA (€)","Mode","Notes"'
  const lines = rows.map((v) => {
    const platNom = (v.plat as unknown as { nom: string } | null)?.nom ?? ''
    return [
      csvField(v.date),
      csvField(v.service),
      csvField(platNom),
      csvField(v.nb_couverts),
      csvField(v.panier_moyen != null ? v.panier_moyen.toFixed(2) : ''),
      csvField(v.montant_total != null ? v.montant_total.toFixed(2) : ''),
      csvField(v.mode_saisie),
      csvField(v.notes),
    ].join(',')
  })

  const csv = [header, ...lines].join('\n')

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ventes-${dateDebut}-${dateFin}.csv"`,
    },
  })
}
