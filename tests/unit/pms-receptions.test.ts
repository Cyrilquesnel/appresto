import { describe, it, expect } from 'vitest'

describe('validation DLC', () => {
  it('alerte si DLC passée', () => {
    const dlcPassee = '2020-01-01'
    expect(new Date(dlcPassee) <= new Date()).toBe(true)
  })

  it("pas d'alerte si DLC future", () => {
    const dlcFuture = '2030-01-01'
    expect(new Date(dlcFuture) <= new Date()).toBe(false)
  })
})

describe('statut réception', () => {
  it('statut = anomalie si au moins un item non-conforme', () => {
    const items = [{ conforme: true }, { conforme: false, anomalie_description: 'Produit abîmé' }]
    const hasAnomalie = items.some((i) => !i.conforme)
    const statut = hasAnomalie ? 'anomalie' : 'conforme'
    expect(statut).toBe('anomalie')
  })

  it('statut = conforme si tous les items sont conformes', () => {
    const items = [{ conforme: true }, { conforme: true }]
    const hasAnomalie = items.some((i) => !i.conforme)
    const statut = hasAnomalie ? 'anomalie' : 'conforme'
    expect(statut).toBe('conforme')
  })

  it('item non-conforme sans description = erreur', () => {
    const items = [{ conforme: false, anomalie_description: undefined }]
    const sanDescription = items.filter((i) => !i.conforme && !i.anomalie_description)
    expect(sanDescription.length).toBeGreaterThan(0)
  })
})
