'use client'

import { useRef, useState, useCallback } from 'react'
import type { DetectedIngredient } from '@/lib/ai/gemini'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalysisResult {
  ingredients: DetectedIngredient[]
  type_plat: string
  confiance: number
  remarques: string | null
}

type Step = 'upload' | 'result' | 'confirmation'

// ─── Constantes ───────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  viande: 'Viande',
  poisson: 'Poisson',
  legume: 'Légume',
  feculent: 'Féculent',
  sauce: 'Sauce',
  fromage: 'Fromage',
  laitage: 'Laitage',
  autre: 'Autre',
}

const CATEGORY_COLORS: Record<string, string> = {
  viande: '#dc2626',
  poisson: '#2563eb',
  legume: '#16a34a',
  feculent: '#ca8a04',
  sauce: '#9333ea',
  fromage: '#ea580c',
  laitage: '#0891b2',
  autre: '#6b7280',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function estimateFoodCost(ingredients: DetectedIngredient[]): string {
  const withGrammage = ingredients.filter((i) => i.grammage_suggere && i.grammage_suggere > 0)
  if (withGrammage.length === 0) return 'non estimable sur photo'
  const totalGrams = withGrammage.reduce((acc, i) => acc + (i.grammage_suggere ?? 0), 0)
  // Estimation brute : 0.8–2.5€ / 100g selon catégorie
  const cost = withGrammage.reduce((acc, i) => {
    const rate =
      i.categorie === 'viande'
        ? 2.5
        : i.categorie === 'poisson'
          ? 3.0
          : i.categorie === 'fromage'
            ? 2.0
            : i.categorie === 'feculent'
              ? 0.4
              : 0.8
    return acc + ((i.grammage_suggere ?? 0) / 100) * rate
  }, 0)
  return `~${cost.toFixed(2)} € (${totalGrams} g estimés)`
}

function ConfianceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#ca8a04' : '#dc2626'
  const label = pct >= 80 ? 'Haute' : pct >= 60 ? 'Moyenne' : 'Faible'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: `${color}18`,
        color,
        border: `1px solid ${color}40`,
        borderRadius: 20,
        padding: '3px 12px',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
          display: 'inline-block',
        }}
      />
      Confiance {label} ({pct}%)
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FicheGratuitePage() {
  const [step, setStep] = useState<Step>('upload')
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)

  const [email, setEmail] = useState('')
  const [nomRestaurant, setNomRestaurant] = useState('')
  const [ville, setVille] = useState('')
  const [isCapturing, setIsCapturing] = useState(false)
  const [captureError, setCaptureError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Handlers upload ──────────────────────────────────────────────────────

  const handleFile = useCallback((f: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      setAnalyzeError('Format invalide. Utilisez JPEG, PNG ou WebP.')
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      setAnalyzeError('Image trop grande (max 10 Mo).')
      return
    }
    setFile(f)
    setAnalyzeError(null)
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(f)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const dropped = e.dataTransfer.files[0]
      if (dropped) handleFile(dropped)
    },
    [handleFile]
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) handleFile(selected)
  }

  // ─── Analyse Gemini ───────────────────────────────────────────────────────

  const handleAnalyze = async () => {
    if (!file) return
    setIsAnalyzing(true)
    setAnalyzeError(null)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch('/api/analyze-dish-public', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setAnalyzeError(data.error ?? "Erreur lors de l'analyse.")
        return
      }
      setResult(data as AnalysisResult)
      setStep('result')
    } catch {
      setAnalyzeError('Erreur réseau. Vérifiez votre connexion.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // ─── Capture email ────────────────────────────────────────────────────────

  const handleCapture = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setIsCapturing(true)
    setCaptureError(null)
    try {
      const res = await fetch('/api/lead-magnet-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          nom_restaurant: nomRestaurant || undefined,
          ville: ville || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCaptureError(data.error ?? 'Une erreur est survenue.')
        return
      }
      setStep('confirmation')
    } catch {
      setCaptureError('Erreur réseau. Réessayez.')
    } finally {
      setIsCapturing(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
      }}
    >
      {/* Header */}
      <header
        style={{
          background: '#002395',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: '#ED2939',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 18,
              color: '#fff',
              letterSpacing: -1,
            }}
          >
            R
          </div>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>Le Rush</span>
        </div>
        <a
          href="https://lerush.app"
          style={{ color: '#94a3b8', fontSize: 13, textDecoration: 'none' }}
        >
          lerush.app
        </a>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 64px' }}>
        {/* ── ÉTAPE 1 : Upload ── */}
        {step === 'upload' && (
          <>
            {/* Hero */}
            <div style={{ textAlign: 'center', margin: '32px 0 40px' }}>
              <div
                style={{
                  display: 'inline-block',
                  background: '#ED293918',
                  color: '#ED2939',
                  border: '1px solid #ED293940',
                  borderRadius: 20,
                  padding: '4px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 16,
                }}
              >
                100% gratuit — aucune carte requise
              </div>
              <h1
                style={{
                  fontSize: 'clamp(24px, 5vw, 32px)',
                  fontWeight: 800,
                  color: '#05060F',
                  margin: '0 0 12px',
                  lineHeight: 1.2,
                  letterSpacing: -0.5,
                }}
              >
                Votre fiche technique en <span style={{ color: '#ED2939' }}>30 secondes</span>
              </h1>
              <p style={{ color: '#4b5563', fontSize: 16, margin: 0, lineHeight: 1.6 }}>
                Photo de votre plat → ingrédients, allergènes, food cost estimé.
                <br />
                Technologie IA professionnelle, gratuitement.
              </p>
            </div>

            {/* Zone upload */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => !file && fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragging ? '#ED2939' : file ? '#002395' : '#d1d5db'}`,
                borderRadius: 16,
                padding: file ? 0 : '40px 24px',
                textAlign: 'center',
                cursor: file ? 'default' : 'pointer',
                background: isDragging ? '#ED293908' : file ? 'transparent' : '#fff',
                transition: 'border-color 0.2s, background 0.2s',
                overflow: 'hidden',
              }}
            >
              {preview ? (
                <div style={{ position: 'relative' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt="Aperçu du plat"
                    style={{
                      width: '100%',
                      maxHeight: 320,
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setFile(null)
                      setPreview(null)
                      setAnalyzeError(null)
                    }}
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      background: '#05060Fcc',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    Changer
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📸</div>
                  <p style={{ color: '#374151', fontWeight: 600, margin: '0 0 6px', fontSize: 16 }}>
                    Glissez une photo ici
                  </p>
                  <p style={{ color: '#9ca3af', fontSize: 13, margin: '0 0 20px' }}>
                    ou cliquez pour choisir · JPEG, PNG, WebP · max 10 Mo
                  </p>
                  <button
                    type="button"
                    style={{
                      background: '#002395',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 10,
                      padding: '12px 24px',
                      cursor: 'pointer',
                      fontSize: 15,
                      fontWeight: 700,
                    }}
                  >
                    Prendre une photo
                  </button>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handleInputChange}
            />

            {analyzeError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 10,
                  padding: '12px 16px',
                  color: '#dc2626',
                  fontSize: 14,
                  marginTop: 16,
                }}
              >
                {analyzeError}
              </div>
            )}

            {file && (
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: 20,
                  background: isAnalyzing ? '#9ca3af' : '#ED2939',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 12,
                  padding: '16px',
                  cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                  fontSize: 17,
                  fontWeight: 800,
                  letterSpacing: -0.3,
                  transition: 'background 0.2s',
                }}
              >
                {isAnalyzing ? 'Analyse en cours…' : 'Analyser mon plat →'}
              </button>
            )}

            {isAnalyzing && (
              <p
                style={{
                  textAlign: 'center',
                  color: '#6b7280',
                  fontSize: 14,
                  marginTop: 12,
                }}
              >
                Gemini analyse la photo… (jusqu'à 30s)
              </p>
            )}

            {/* Social proof */}
            <div
              style={{
                display: 'flex',
                gap: 16,
                marginTop: 40,
                flexWrap: 'wrap',
              }}
            >
              {[
                { icon: '🧑‍🍳', label: 'Pour les pros', sub: 'Cuisiniers, chefs, gérants' },
                { icon: '⚡', label: 'Instantané', sub: 'Résultat en 30 secondes' },
                { icon: '🔒', label: 'Privé', sub: 'Aucune donnée stockée' },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    flex: '1 1 140px',
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 12,
                    padding: '16px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{item.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#05060F' }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{item.sub}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── ÉTAPE 2 : Résultat ── */}
        {step === 'result' && result && (
          <>
            <div style={{ margin: '24px 0 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h2
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: '#05060F',
                    margin: 0,
                    letterSpacing: -0.5,
                  }}
                >
                  {result.type_plat}
                </h2>
                <ConfianceBadge value={result.confiance} />
              </div>
              {result.remarques && (
                <p
                  style={{ color: '#6b7280', fontSize: 14, margin: '8px 0 0', fontStyle: 'italic' }}
                >
                  {result.remarques}
                </p>
              )}
            </div>

            {/* Aperçu miniature */}
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Plat analysé"
                style={{
                  width: '100%',
                  maxHeight: 200,
                  objectFit: 'cover',
                  borderRadius: 12,
                  marginBottom: 20,
                }}
              />
            )}

            {/* Food cost */}
            <div
              style={{
                background: '#002395',
                borderRadius: 12,
                padding: '16px 20px',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  FOOD COST ESTIMÉ
                </div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>
                  {estimateFoodCost(result.ingredients)}
                </div>
              </div>
              <div style={{ fontSize: 32 }}>💰</div>
            </div>

            {/* Liste ingrédients */}
            <div
              style={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                overflow: 'hidden',
                marginBottom: 28,
              }}
            >
              <div
                style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid #f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 15, color: '#05060F' }}>
                  Ingrédients détectés
                </span>
                <span style={{ color: '#6b7280', fontSize: 13 }}>
                  {result.ingredients.length} ingrédient{result.ingredients.length > 1 ? 's' : ''}
                </span>
              </div>

              {result.ingredients.map((ing, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px 16px',
                    borderBottom:
                      idx < result.ingredients.length - 1 ? '1px solid #f3f4f6' : 'none',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: CATEGORY_COLORS[ing.categorie] ?? '#6b7280',
                      marginTop: 6,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 15, color: '#05060F' }}>
                        {ing.nom}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: CATEGORY_COLORS[ing.categorie] ?? '#6b7280',
                          background: `${CATEGORY_COLORS[ing.categorie] ?? '#6b7280'}18`,
                          border: `1px solid ${CATEGORY_COLORS[ing.categorie] ?? '#6b7280'}30`,
                          borderRadius: 10,
                          padding: '1px 8px',
                        }}
                      >
                        {CATEGORY_LABELS[ing.categorie] ?? ing.categorie}
                      </span>
                      {!ing.visible && (
                        <span
                          style={{
                            fontSize: 11,
                            color: '#9ca3af',
                            fontStyle: 'italic',
                          }}
                        >
                          (supposé)
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: 12,
                        marginTop: 4,
                        fontSize: 13,
                        color: '#6b7280',
                        flexWrap: 'wrap',
                      }}
                    >
                      {ing.grammage_suggere && <span>~{ing.grammage_suggere} g</span>}
                      {ing.allergenes && ing.allergenes.length > 0 && (
                        <span style={{ color: '#dc2626' }}>⚠ {ing.allergenes.join(', ')}</span>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color:
                        ing.confiance >= 0.8
                          ? '#16a34a'
                          : ing.confiance >= 0.6
                            ? '#ca8a04'
                            : '#dc2626',
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {Math.round(ing.confiance * 100)}%
                  </div>
                </div>
              ))}
            </div>

            {/* Séparateur CTA */}
            <div
              style={{
                background: '#fff',
                border: '2px solid #ED2939',
                borderRadius: 16,
                padding: '28px 24px',
              }}
            >
              <h3
                style={{
                  margin: '0 0 6px',
                  fontSize: 18,
                  fontWeight: 800,
                  color: '#05060F',
                  letterSpacing: -0.3,
                }}
              >
                Voulez-vous cette fiche dans votre app ?
              </h3>
              <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 20px', lineHeight: 1.6 }}>
                PDF officiel, fiches illimitées, bons de commande, HACCP — recevez un accès beta.
              </p>

              <form onSubmit={handleCapture}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <input
                    type="email"
                    placeholder="votre@email.com *"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{
                      border: '1.5px solid #d1d5db',
                      borderRadius: 10,
                      padding: '13px 16px',
                      fontSize: 15,
                      outline: 'none',
                      color: '#05060F',
                      background: '#f9fafb',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Nom de votre restaurant (optionnel)"
                    value={nomRestaurant}
                    onChange={(e) => setNomRestaurant(e.target.value)}
                    style={{
                      border: '1.5px solid #d1d5db',
                      borderRadius: 10,
                      padding: '13px 16px',
                      fontSize: 15,
                      outline: 'none',
                      color: '#05060F',
                      background: '#f9fafb',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Ville (optionnel)"
                    value={ville}
                    onChange={(e) => setVille(e.target.value)}
                    style={{
                      border: '1.5px solid #d1d5db',
                      borderRadius: 10,
                      padding: '13px 16px',
                      fontSize: 15,
                      outline: 'none',
                      color: '#05060F',
                      background: '#f9fafb',
                    }}
                  />

                  {captureError && (
                    <div
                      style={{
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: 8,
                        padding: '10px 14px',
                        color: '#dc2626',
                        fontSize: 14,
                      }}
                    >
                      {captureError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isCapturing || !email}
                    style={{
                      background: isCapturing || !email ? '#9ca3af' : '#ED2939',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 10,
                      padding: '15px',
                      cursor: isCapturing || !email ? 'not-allowed' : 'pointer',
                      fontSize: 16,
                      fontWeight: 800,
                      letterSpacing: -0.2,
                      transition: 'background 0.2s',
                    }}
                  >
                    {isCapturing ? 'Envoi…' : 'Recevoir mes fiches gratuitement →'}
                  </button>

                  <p style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center', margin: 0 }}>
                    Sans engagement · Pas de spam · Désabonnement en 1 clic
                  </p>
                </div>
              </form>
            </div>

            <button
              onClick={() => {
                setStep('upload')
                setFile(null)
                setPreview(null)
                setResult(null)
              }}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 16,
                background: 'transparent',
                color: '#6b7280',
                border: '1.5px solid #e5e7eb',
                borderRadius: 10,
                padding: '12px',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Analyser un autre plat
            </button>
          </>
        )}

        {/* ── ÉTAPE 3 : Confirmation ── */}
        {step === 'confirmation' && (
          <div style={{ textAlign: 'center', padding: '48px 16px' }}>
            <div style={{ fontSize: 72, marginBottom: 24 }}>🚀</div>
            <h2
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: '#05060F',
                margin: '0 0 12px',
                letterSpacing: -0.5,
              }}
            >
              C'est parti !
            </h2>
            <p
              style={{
                color: '#4b5563',
                fontSize: 16,
                lineHeight: 1.7,
                margin: '0 auto 32px',
                maxWidth: 400,
              }}
            >
              Vous recevrez votre accès beta sous 48h.
              <br />
              Un email de confirmation vient de vous être envoyé.
            </p>

            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 12,
                padding: '20px 24px',
                marginBottom: 32,
                textAlign: 'left',
                maxWidth: 400,
                margin: '0 auto 32px',
              }}
            >
              <p
                style={{
                  color: '#166534',
                  fontWeight: 700,
                  fontSize: 14,
                  margin: '0 0 8px',
                }}
              >
                Ce que vous allez recevoir :
              </p>
              <ul
                style={{
                  color: '#16a34a',
                  fontSize: 14,
                  margin: 0,
                  paddingLeft: 20,
                  lineHeight: 1.9,
                }}
              >
                <li>Accès complet à l'app Le Rush</li>
                <li>Fiches techniques illimitées en PDF</li>
                <li>Food cost en temps réel</li>
                <li>Module HACCP températures</li>
              </ul>
            </div>

            <a
              href="https://lerush.app"
              style={{
                display: 'inline-block',
                background: '#002395',
                color: '#fff',
                padding: '15px 32px',
                borderRadius: 12,
                textDecoration: 'none',
                fontWeight: 800,
                fontSize: 16,
                letterSpacing: -0.3,
              }}
            >
              Découvrir Le Rush →
            </a>

            <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 24 }}>
              Questions ? Contactez-nous à{' '}
              <a href="mailto:bonjour@lerush.app" style={{ color: '#6b7280' }}>
                bonjour@lerush.app
              </a>
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
