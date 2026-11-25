import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { BottomNav, FigmaIcon, Phone } from '@/components/yoonu'
import { useAction } from '@/lib/actions'
import type { ContributionNetwork, ContributionStopSummary } from '@/lib/transit-api'
import { listContributionTransitStops } from '@/server/transit'
import { submitContribution } from '@/server/yoonu'

export const Route = createFileRoute('/contribuer')({ component: Contribuer })

const NETWORKS: { id: ContributionNetwork; label: string }[] = [
  { id: 'aftu_dakar', label: 'AFTU Dakar' },
  { id: 'tata_thies', label: 'Tata Thiès' },
]

function Contribuer() {
  const [network, setNetwork] = useState<ContributionNetwork>('aftu_dakar')
  const [stops, setStops] = useState<ContributionStopSummary[]>([])
  const [selectedStopId, setSelectedStopId] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [proposedLabel, setProposedLabel] = useState('')
  const [details, setDetails] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError(null)
    setSelectedStopId('')
    void listContributionTransitStops({ data: { network } }).then((result) => {
      if (!active) return
      if (result.ok) {
        setStops(result.data.stops)
        setSelectedStopId(result.data.stops[0]?.id ?? '')
      } else {
        setStops([])
        setLoadError(result.message)
      }
    }).catch(() => {
      if (active) {
        setStops([])
        setLoadError('Impossible de charger les arrêts à compléter. Vérifie ta connexion puis réessaie.')
      }
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [network, retryKey])

  const submit = useAction(submitContribution, {
    onSuccess: () => {
      setSubmitted(true)
      setProposedLabel('')
      setDetails('')
    },
  })

  const selectedStop = stops.find((stop) => stop.id === selectedStopId)
  const canSubmit = Boolean(selectedStop && proposedLabel.trim().length >= 2 && !submit.pending && !submit.uncertain)

  return (
    <Phone>
      <div className="flex items-center gap-3 px-5 pt-2">
        <Link to="/accueil" aria-label="Retour à l’accueil"><FigmaIcon name="arrow-left" size={24} /></Link>
        <h1 className="text-[18px] font-bold">Contribuer</h1>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        <header>
          <h2 className="text-[22px] font-bold">Aide-nous à compléter les arrêts</h2>
          <p className="mt-2 text-[14px] leading-6 text-[#5B6785]">
            Choisis un réseau et un arrêt incomplet, puis propose un repère connu. Ta proposition sera relue ; elle ne rend pas l’arrêt vérifié.
          </p>
        </header>

        <section className="rounded-[20px] border border-[#E3E8F3] bg-white p-4">
          <label htmlFor="contribution-network" className="text-[14px] font-semibold">Réseau</label>
          <select
            id="contribution-network"
            value={network}
            onChange={(event) => setNetwork(event.target.value as ContributionNetwork)}
            className="mt-2 min-h-12 w-full rounded-xl border border-[#E3E8F3] bg-white px-3 text-[15px]"
          >
            {NETWORKS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>

          <h3 className="mt-5 text-[15px] font-bold">Arrêts à compléter</h3>
          {loading && <p className="py-4 text-[14px] text-[#5B6785]" role="status">Chargement des arrêts…</p>}
          {loadError && (
            <div className="mt-3 rounded-xl border border-[#F5C518] bg-[#FFF1D6] p-3" role="alert">
              <p className="text-[14px]">{loadError}</p>
              <button type="button" onClick={() => setRetryKey((value) => value + 1)} className="mt-3 min-h-11 rounded-full border border-[#1F5EFF] px-4 font-semibold text-[#0B3BCC]">Réessayer</button>
            </div>
          )}
          {!loading && !loadError && stops.length === 0 && (
            <p className="mt-2 rounded-xl bg-[#F6F8FB] p-3 text-[14px] text-[#5B6785]" role="status">
              Aucun arrêt incomplet disponible pour ce réseau pour le moment.
            </p>
          )}
          {!loading && !loadError && stops.length > 0 && (
            <div className="mt-2 space-y-2">
              {stops.map((stop) => (
                <label key={stop.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[#E3E8F3] p-3">
                  <input
                    type="radio"
                    name="incomplete-stop"
                    value={stop.id}
                    checked={selectedStopId === stop.id}
                    onChange={() => { setSelectedStopId(stop.id); setSubmitted(false) }}
                    className="h-5 w-5 accent-[#1F5EFF]"
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold">{stop.name?.trim() || 'Nom à compléter'}</span>
                    <span className="block break-all text-[12px] text-[#5B6785]">Référence : {stop.id}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </section>

        {!loading && !loadError && selectedStop && (
          <form
            className="space-y-3 rounded-[20px] border border-[#E3E8F3] bg-white p-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (!canSubmit) return
              setSubmitted(false)
              submit.run({ data: {
                name: proposedLabel.trim(),
                type: 'incomplete_stop_reference',
                lineName: network,
                message: `Arrêt ${selectedStop.id} — repère proposé : ${proposedLabel.trim()}${details.trim() ? ` — précision : ${details.trim()}` : ''}`,
              } })
            }}
          >
            <h3 className="text-[16px] font-bold">Proposer un repère</h3>
            <label htmlFor="proposed-stop-label" className="block text-[14px] font-medium">Nom ou repère que tu connais</label>
            <input
              id="proposed-stop-label"
              value={proposedLabel}
              onChange={(event) => { setProposedLabel(event.target.value); setSubmitted(false); submit.clearError() }}
              maxLength={120}
              minLength={2}
              required
              className="min-h-12 w-full rounded-xl border border-[#E3E8F3] px-3 text-[15px]"
              placeholder="Ex. un lieu connu près de l’arrêt"
            />
            <label htmlFor="contribution-details" className="block text-[14px] font-medium">Précision (facultatif)</label>
            <textarea
              id="contribution-details"
              value={details}
              onChange={(event) => { setDetails(event.target.value); setSubmitted(false); submit.clearError() }}
              maxLength={1000}
              rows={3}
              className="w-full rounded-xl border border-[#E3E8F3] px-3 py-2 text-[15px]"
              placeholder="Ajoute un détail utile, sans coordonnées personnelles."
            />
            <button type="submit" disabled={!canSubmit} className="min-h-12 w-full rounded-full bg-[#1F5EFF] px-5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
              {submit.pending ? 'Envoi…' : 'Envoyer la proposition'}
            </button>
            {submit.error && <p className="text-[14px] text-[#D92D3A]" role="alert">{submit.error}</p>}
            {submitted && <p className="text-[14px] font-medium text-[#12A150]" role="status">Proposition reçue. L’arrêt reste incomplet jusqu’à sa vérification.</p>}
          </form>
        )}

        <p className="text-[12px] leading-5 text-[#5B6785]">
          Les propositions sont enregistrées pour examen. Elles ne sont pas ajoutées automatiquement aux trajets proposés aux voyageurs.
        </p>
      </div>
      <BottomNav active="contribuer" />
    </Phone>
  )
}
