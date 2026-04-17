export interface Prospect {
  id: string
  nom: string
  telephone: string | null
  email: string | null
  website: string | null
  ville: string | null
  code_postal: string | null
  score: number | null
  score_breakdown: Record<string, number> | null
  rating: number | null
  reviews_count: number | null
  type_cuisine: string | null
  statut: 'new' | 'contacted' | 'replied' | 'demo' | 'client' | 'dead'
  whatsapp_sent_at: string | null
  last_reply_at: string | null
  last_reply_text: string | null
  intent: 'hot' | 'warm' | 'cold' | 'unsubscribe' | null
  notes: string | null
  source: string
  created_at: string
}
