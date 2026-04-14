import { describe, it, expect } from 'vitest'

describe('Checklist validation', () => {
  it('peut valider si tous les items obligatoires sont cochés', () => {
    const items = [
      { id: '1', obligatoire: true },
      { id: '2', obligatoire: true },
      { id: '3', obligatoire: false },
    ]
    const checked: Record<string, boolean> = { '1': true, '2': true, '3': false }
    const allRequired = items.filter((i) => i.obligatoire).every((i) => checked[i.id])
    expect(allRequired).toBe(true)
  })

  it('ne peut pas valider si item obligatoire non coché', () => {
    const items = [
      { id: '1', obligatoire: true },
      { id: '2', obligatoire: true },
    ]
    const checked: Record<string, boolean> = { '1': true, '2': false }
    const allRequired = items.filter((i) => i.obligatoire).every((i) => checked[i.id])
    expect(allRequired).toBe(false)
  })

  it('items non-obligatoires ne bloquent pas la validation', () => {
    const items = [
      { id: '1', obligatoire: true },
      { id: '2', obligatoire: false },
    ]
    const checked: Record<string, boolean> = { '1': true, '2': false }
    const allRequired = items.filter((i) => i.obligatoire).every((i) => checked[i.id])
    expect(allRequired).toBe(true)
  })

  it('compte les items obligatoires restants', () => {
    const items = [
      { id: '1', obligatoire: true },
      { id: '2', obligatoire: true },
      { id: '3', obligatoire: true },
    ]
    const checked: Record<string, boolean> = { '1': true, '2': false, '3': false }
    const remaining = items.filter((i) => i.obligatoire && !checked[i.id]).length
    expect(remaining).toBe(2)
  })
})
