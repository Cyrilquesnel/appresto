import { describe, it, expect } from 'vitest'
import { formatBonMessage } from '@/lib/whatsapp'
import type { BonDeCommandeData } from '@/lib/whatsapp'

const bonTest: BonDeCommandeData = {
  id: 'test-bon-id',
  restaurant_nom: 'La Belle Assiette',
  fournisseur: { nom: 'Metro Cash & Carry', contact_whatsapp: '+33612345678' },
  date_livraison_souhaitee: '2026-04-15',
  lignes: [
    { nom_produit: 'Beurre AOP', quantite: 5, unite: 'kg', prix_unitaire: 8.5 },
    { nom_produit: 'Crème fraîche', quantite: 2, unite: 'L', prix_unitaire: 3.2 },
    { nom_produit: 'Filet de bœuf', quantite: 1, unite: 'kg' },
  ],
  total_ht: 49.9,
  notes: 'Livraison avant 8h',
}

describe('formatBonMessage', () => {
  it('contient le nom du restaurant', () => {
    const msg = formatBonMessage(bonTest)
    expect(msg).toContain('La Belle Assiette')
  })

  it('contient le total HT formaté', () => {
    const msg = formatBonMessage(bonTest)
    expect(msg).toContain('49.90 €')
  })

  it('contient toutes les lignes de produit', () => {
    const msg = formatBonMessage(bonTest)
    expect(msg).toContain('Beurre AOP')
    expect(msg).toContain('Crème fraîche')
    expect(msg).toContain('Filet de bœuf')
  })

  it('contient la date de livraison', () => {
    const msg = formatBonMessage(bonTest)
    expect(msg).toContain('15/04/2026')
  })

  it('contient les notes', () => {
    const msg = formatBonMessage(bonTest)
    expect(msg).toContain('Livraison avant 8h')
  })

  it('calcule le sous-total ligne quand prix_unitaire présent', () => {
    const msg = formatBonMessage(bonTest)
    expect(msg).toContain('42.50 €') // 5 × 8.50
    expect(msg).toContain('6.40 €') // 2 × 3.20
  })

  it('affiche juste le nom si prix_unitaire absent', () => {
    const msg = formatBonMessage(bonTest)
    expect(msg).toContain('Filet de bœuf: 1 kg')
    // Pas de total pour cette ligne
  })

  it('fonctionne sans date ni notes', () => {
    const bonMinimal: BonDeCommandeData = {
      ...bonTest,
      date_livraison_souhaitee: null,
      notes: null,
    }
    const msg = formatBonMessage(bonMinimal)
    expect(msg).toContain('La Belle Assiette')
    expect(msg).not.toContain('Livraison souhaitée')
    expect(msg).not.toContain('Notes')
  })
})
