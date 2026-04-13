import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { ingredient_id, nouveau_prix } = await req.json()
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: lignes } = await supabase
    .from('fiche_technique')
    .select('plat_id, grammage, unite')
    .eq('ingredient_id', ingredient_id)

  if (!lignes?.length) return new Response(JSON.stringify({ updated: 0 }))

  const platIds = [...new Set(lignes.map((l: any) => l.plat_id))]

  for (const platId of platIds) {
    const { data: allLignes } = await supabase
      .from('fiche_technique')
      .select('grammage, ingredient_id, mercuriale!inner(prix)')
      .eq('plat_id', platId)

    const cout = allLignes?.reduce((sum: number, l: any) => {
      const prix = l.mercuriale?.[0]?.prix ?? 0
      return sum + (l.grammage / 1000) * prix
    }, 0) ?? 0

    await supabase.from('plats')
      .update({ cout_de_revient: cout, updated_at: new Date().toISOString() })
      .eq('id', platId)

    await supabase.from('fiche_technique_versions').insert({
      plat_id: platId,
      version_number: Date.now(),
      ingredients_snapshot: allLignes,
      cout_calcule: cout
    })
  }

  return new Response(JSON.stringify({ updated: platIds.length }))
})
