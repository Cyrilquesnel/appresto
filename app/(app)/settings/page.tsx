'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc/client'
import { ComingSoonFeature } from '@/components/ui/ComingSoonFeature'

const TYPES = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'brasserie', label: 'Brasserie' },
  { value: 'gastronomique', label: 'Gastronomique' },
  { value: 'snack', label: 'Snack / Fast-casual' },
  { value: 'traiteur', label: 'Traiteur' },
  { value: 'autre', label: 'Autre' },
] as const

type TypeEtablissement = (typeof TYPES)[number]['value']

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0'

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const { data: restaurant } = trpc.dashboard.getMyRestaurant.useQuery()
  const updateRestaurant = trpc.dashboard.updateRestaurant.useMutation()
  const changePassword = trpc.account.changePassword.useMutation()
  const changeEmail = trpc.account.changeEmail.useMutation()
  const deleteAccount = trpc.account.deleteAccount.useMutation()

  // Restaurant profile
  const [nom, setNom] = useState('')
  const [type, setType] = useState<TypeEtablissement | ''>('')
  const [saved, setSaved] = useState(false)

  // Password change
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwDone, setPwDone] = useState(false)

  // Email change
  const [newEmail, setNewEmail] = useState('')
  const [emailDone, setEmailDone] = useState(false)

  // Delete account
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Push notification state (client-only, avoid hydration mismatch)
  const [pushPermission, setPushPermission] = useState<NotificationPermission | null>(null)
  useEffect(() => {
    if ('Notification' in window) setPushPermission(Notification.permission)
  }, [])

  useEffect(() => {
    if (restaurant) {
      setNom(restaurant.nom ?? '')
      setType((restaurant.type_etablissement as TypeEtablissement | null) ?? '')
    }
  }, [restaurant])

  const handleSave = async () => {
    await updateRestaurant.mutateAsync({
      nom: nom || undefined,
      type_etablissement: (type as TypeEtablissement) || undefined,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const handleChangePassword = async () => {
    setPwError(null)
    if (pwForm.next !== pwForm.confirm) {
      setPwError('Les mots de passe ne correspondent pas')
      return
    }
    if (pwForm.next.length < 8) {
      setPwError('Minimum 8 caractères')
      return
    }
    try {
      await changePassword.mutateAsync({
        current_password: pwForm.current,
        new_password: pwForm.next,
      })
      setPwDone(true)
      setPwForm({ current: '', next: '', confirm: '' })
      setTimeout(() => setPwDone(false), 3000)
    } catch (e: unknown) {
      setPwError((e as { message?: string }).message ?? 'Erreur')
    }
  }

  const handleChangeEmail = async () => {
    try {
      await changeEmail.mutateAsync({ new_email: newEmail })
      setEmailDone(true)
      setNewEmail('')
    } catch {
      // error handled by tRPC
    }
  }

  const handleDeleteAccount = async () => {
    await deleteAccount.mutateAsync({ confirmation: 'SUPPRIMER MON COMPTE' })
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-6">
      <h1 className="text-xl font-bold">Paramètres</h1>

      {/* ─── Profil restaurant ─── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
        <h2 className="font-semibold text-gray-900">Profil du restaurant</h2>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Nom du restaurant</label>
          <input
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Le Bistrot du Chef"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Type d&apos;établissement</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TypeEtablissement | '')}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white"
          >
            <option value="">Sélectionner…</option>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSave}
          disabled={updateRestaurant.isPending}
          className="w-full py-2.5 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-60"
        >
          {updateRestaurant.isPending ? 'Enregistrement…' : saved ? '✓ Enregistré' : 'Enregistrer'}
        </button>
      </div>

      {/* ─── Mon compte ─── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
        <h2 className="font-semibold text-gray-900">Mon compte</h2>

        {/* Changer le mot de passe */}
        <details className="group">
          <summary className="flex justify-between items-center cursor-pointer list-none py-1">
            <span className="text-sm font-medium text-gray-700">Changer le mot de passe</span>
            <span className="text-gray-400 text-xs transition-transform group-open:rotate-180">▼</span>
          </summary>
          <div className="mt-3 space-y-2">
            <input
              type="password"
              placeholder="Mot de passe actuel"
              value={pwForm.current}
              onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <input
              type="password"
              placeholder="Nouveau mot de passe (8 caractères min.)"
              value={pwForm.next}
              onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <input
              type="password"
              placeholder="Confirmer le nouveau mot de passe"
              value={pwForm.confirm}
              onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            {pwError && <p className="text-xs text-red-600">{pwError}</p>}
            {pwDone && <p className="text-xs text-green-600">✓ Mot de passe mis à jour</p>}
            <button
              type="button"
              disabled={changePassword.isPending || !pwForm.current || !pwForm.next}
              onClick={handleChangePassword}
              className="w-full py-2.5 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-60"
            >
              {changePassword.isPending ? 'Mise à jour…' : 'Mettre à jour'}
            </button>
          </div>
        </details>

        <hr className="border-gray-100" />

        {/* Changer l'email */}
        <details className="group">
          <summary className="flex justify-between items-center cursor-pointer list-none py-1">
            <span className="text-sm font-medium text-gray-700">Changer l&apos;email</span>
            <span className="text-gray-400 text-xs transition-transform group-open:rotate-180">▼</span>
          </summary>
          <div className="mt-3 space-y-2">
            <input
              type="email"
              placeholder="Nouvel email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            {emailDone && (
              <p className="text-xs text-green-600">
                ✓ Email de confirmation envoyé — vérifiez votre boîte mail
              </p>
            )}
            <button
              type="button"
              disabled={changeEmail.isPending || !newEmail}
              onClick={handleChangeEmail}
              className="w-full py-2.5 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-60"
            >
              {changeEmail.isPending ? 'Envoi…' : 'Envoyer la confirmation'}
            </button>
          </div>
        </details>

        <hr className="border-gray-100" />

        {/* Supprimer le compte */}
        <button
          type="button"
          onClick={() => setShowDeleteDialog(true)}
          className="text-sm text-red-500 font-medium py-1"
        >
          Supprimer mon compte
        </button>

        {/* Modale de confirmation suppression */}
        {showDeleteDialog && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
              <h3 className="font-bold text-gray-900">Supprimer mon compte</h3>
              <p className="text-sm text-gray-600">
                Cette action est <strong>irréversible</strong>. Toutes vos données (restaurant,
                plats, ventes, PMS) seront définitivement supprimées conformément au RGPD.
              </p>
              <p className="text-sm text-gray-600">
                Tapez <strong className="font-mono">SUPPRIMER MON COMPTE</strong> pour confirmer :
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="SUPPRIMER MON COMPTE"
                className="w-full border border-red-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 font-mono"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteDialog(false)
                    setDeleteConfirmText('')
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={
                    deleteConfirmText !== 'SUPPRIMER MON COMPTE' || deleteAccount.isPending
                  }
                  onClick={handleDeleteAccount}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-40"
                >
                  {deleteAccount.isPending ? 'Suppression…' : 'Supprimer définitivement'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Notifications ─── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900">Notifications</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-700">Notifications push</p>
            <p className="text-xs text-gray-400 mt-0.5">Alertes rappels produits, températures PMS</p>
          </div>
          {pushPermission !== null && (
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${
                pushPermission === 'granted'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {pushPermission === 'granted' ? 'Actif' : 'Inactif'}
            </span>
          )}
        </div>
      </div>

      {/* ─── Multi-établissements — bientôt ─── */}
      <ComingSoonFeature eta="T4 2026">
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-900">Multi-établissements</h2>
          <p className="text-sm text-gray-500 mt-1">
            Gérez plusieurs restaurants depuis un seul compte.
          </p>
        </div>
      </ComingSoonFeature>

      {/* ─── À propos ─── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
        <h2 className="font-semibold text-gray-900">À propos</h2>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Version</span>
          <span className="text-sm text-gray-400 font-mono">{APP_VERSION}</span>
        </div>
        <hr className="border-gray-100" />
        <div className="flex flex-col gap-2">
          <a href="/legal/cgu" className="text-sm text-accent">
            Conditions générales d&apos;utilisation
          </a>
          <a href="/legal/privacy" className="text-sm text-accent">
            Politique de confidentialité
          </a>
        </div>
      </div>

      {/* ─── Déconnexion ─── */}
      <button
        onClick={handleLogout}
        className="w-full py-3 rounded-xl border border-red-300 text-red-600 font-medium text-sm"
      >
        Se déconnecter
      </button>
    </div>
  )
}
