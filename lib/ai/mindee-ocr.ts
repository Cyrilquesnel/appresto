import { v1 as mindeeV1, BufferInput } from 'mindee'
import type { InvoiceData } from './invoice-ocr'

/**
 * Extrait les données d'une facture via Mindee v1 (primaire).
 * Mindee est entraîné sur les factures françaises : Promocash, Metro, Transgourmet, etc.
 * Supporte PDF multi-pages, images JPEG/PNG/WEBP/HEIC nativement.
 *
 * Retourne null si MINDEE_API_KEY absent ou si l'extraction échoue.
 * Dans ce cas, le pipeline bascule sur Gemini (fallback).
 */
export async function extractInvoiceDataMindee(
  buffer: Buffer,
  filename: string
): Promise<InvoiceData | null> {
  if (!process.env.MINDEE_API_KEY) return null

  try {
    const mindeeClient = new mindeeV1.Client({ apiKey: process.env.MINDEE_API_KEY })
    const inputDoc = new BufferInput({ buffer, filename: filename || 'facture.pdf' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await mindeeClient.parse(mindeeV1.product.InvoiceV4 as any, inputDoc)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prediction = (response as any).document?.inference?.prediction
    if (!prediction) return null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lineItems: any[] = prediction.lineItems ?? []

    const lignes: InvoiceData['lignes'] = lineItems
      .filter((item) => {
        const price = item.unitPrice ?? 0
        const desc = (item.description ?? '').trim()
        return price > 0 && desc.length > 0
      })
      .map((item) => ({
        designation: (item.description ?? '').trim(),
        quantite: item.quantity ?? 1,
        unite: 'kg', // Mindee InvoiceV4 ne retourne pas toujours l'unité
        prix_unitaire_ht: item.unitPrice ?? 0,
        total_ht: item.totalAmount ?? undefined,
      }))

    if (lignes.length === 0) return null

    return {
      fournisseur_nom: prediction.supplierName?.value ?? undefined,
      date_facture: prediction.date?.value ?? undefined,
      numero_facture: prediction.invoiceNumber?.value ?? undefined,
      total_ht_facture: prediction.totalNet?.value ?? undefined,
      lignes,
    }
  } catch {
    // Mindee indisponible ou quota dépassé → fallback Gemini
    return null
  }
}
