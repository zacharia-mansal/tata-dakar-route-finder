import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { BottomNav, Phone, SchematicMap } from '@/components/yoonu'
import { getItinerary } from '@/server/yoonu'

export const Route = createFileRoute('/suivi')({
  validateSearch: (s: Record<string, unknown>) => ({
    from: typeof s.from === 'string' ? s.from : 'Castor',
    to: typeof s.to === 'string' ? s.to : 'ISM Dakar',
    etat: typeof s.etat === 'string' ? s.etat : 'encours',
  }),
  loaderDeps: ({ search }) => ({ from: (search as { from: string }).from, to: (search as { to: string }).to }),
  loader: ({ deps }) => getItinerary({ data: deps as { from: string; to: string } }),
  component: Suivi,
})

function Suivi() {
  const itin = Route.useLoaderData()
  const search = Route.useSearch() as { from: string; to: string; etat: string }
  const [progress, setProgress] = useState(4)
  const [share, setShare] = useState(true)
  const [etat, setEtat] = useState(search.etat)
  const [sheet, setSheet] = useState<null | 'signaler' | 'recu'>(null)
  const [niveau, setNiveau] = useState<'peu' | 'debout' | 'complet'>('complet')
  const [motif, setMotif] = useState<string | null>(null)

  useEffect(() => {
    if (etat !== 'encours') return
    const t = setInterval(() => setProgress((p) => (p >= 7 ? 7 : p + 1)), 8000)
    return () => clearInterval(t)
  }, [etat])

  const remaining = Math.max(0, 8 - progress)

  if (etat === 'gps-coupe' || etat === 'batterie' || etat === 'horsligne' || etat === 'attente') {
    const copy: Record<string, { title: string; text: string; cta: string }> = {
      'gps-coupe': { title: 'GPS coupé — on te garde avec toi', text: 'Active ton GPS pour reprendre le suivi. Ton trajet Tata 24 reste affiché, même sans position.', cta: 'Réactiver le GPS' },
      batterie: { title: 'Batterie faible — mode économe', text: 'On réduit la fréquence GPS pour tenir jusqu’à Université. Garde l’écran éteint entre les arrêts.', cta: 'Continuer en mode économe' },
      horsligne: { title: 'Hors-ligne — trajet enregistré', text: 'Pas de connexion ? Ton trajet enregistré reste disponible. Le suivi reprendra dès le retour réseau.', cta: 'Voir le trajet enregistré' },
      attente: { title: 'Pas encore de trajet connu', text: 'Choisis ton départ et ta destination pour lancer un suivi. On s’occupe du reste.', cta: 'Choisir mon trajet' },
    }
    const c = copy[etat]
    return (
      <Phone>
        <div className="flex items-center gap-3 px-5 pt-2">
          <Link to="/parcours" search={{ from: search.from, to: search.to } as never}>←</Link>
          <h1 className="font-bold">Suivi</h1>
        </div>
        <div className="px-5 pt-6">
          <div className="rounded-[20px] border border-[#E3E8F3] bg-white p-6 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF1D6] text-2xl">⚠</span>
            <h2 className="mt-3 text-[20px] font-bold">{c.title}</h2>
            <p className="mt-2 text-[14px] text-[#5B6785]">{c.text}</p>
            <button onClick={() => setEtat('encours')} className="mt-4 flex h-14 w-full items-center justify-center rounded-full bg-[#1F5EFF] font-semibold text-white">{c.cta}</button>
            <div className="mt-2 flex gap-2">
              {['encours', 'gps-coupe', 'batterie', 'horsligne', 'attente'].map((e) => (
                <button key={e} onClick={() => setEtat(e)} className={`rounded-full border px-2 py-1 text-[11px] ${etat === e ? 'border-[#1F5EFF] bg-[#E8EFFF]' : 'border-[#E3E8F3]'}`}>{e}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex-1" />
        <BottomNav active="accueil" />
      </Phone>
    )
  }

  const imminent = progress >= 6

  return (
    <Phone>
      <div className="flex items-center gap-3 px-5 pt-2">
        <Link to="/parcours" search={{ from: search.from, to: search.to } as never} className="text-xl">←</Link>
        <div><h1 className="text-[18px] font-bold">{imminent ? 'Arrivée imminente' : 'Suivi en cours'}</h1><p className="text-[13px] font-medium text-[#12A150]">Ton GPS actif · Tata 24</p></div>
        <span className="ml-auto text-[12px] font-bold">📍 yoonubus</span>
      </div>
      {imminent && (
        <div className="mt-2 bg-[#F5C518] px-5 py-3">
          <p className="text-[18px] font-bold text-[#0F1B3D]">🔔 Prépare-toi à descendre</p>
          <p className="font-semibold text-[#0F1B3D]">Université · dans 2 arrêts</p>
        </div>
      )}
      <div className="px-5 pt-3">
        <button onClick={() => setSheet('signaler')} className="h-14 w-full rounded-full border border-[#1F5EFF] bg-white font-semibold text-[#0B3BCC]">Signaler</button>
        <div className="mt-3 rounded-[20px] border border-[#E3E8F3] bg-white p-3">
          <SchematicMap variant="gps" />
          <div className="flex items-center justify-between px-1 pt-2 text-[12px] text-[#5B6785]">
            <span>🔵 Ta position</span><span>⚪ Arrêts passés</span><span>⚫ Arrivée</span>
          </div>
        </div>
        <div className={`mt-3 rounded-[20px] p-4 ${imminent ? 'bg-[#FFF1D6]' : 'bg-[#E8EFFF]'}`}>
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[#5B6785]">{imminent ? 'Descente dans' : 'Prochain arrêt'}</p>
            <span className="rounded-full bg-[#1F5EFF] px-3 py-1 text-[14px] font-bold text-white">~3 min</span>
          </div>
          <h2 className="text-[22px] font-bold">{imminent ? 'Prépare-toi à descendre' : 'Prochain arrêt'}</h2>
          <div className="mt-2 flex justify-between text-[13px] text-[#5B6785]"><span>{search.from}</span><span>Université</span></div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#0F1B3D10]"><div className="h-full rounded-full bg-[#1F5EFF]" style={{ width: `${(progress / 8) * 100}%` }} /></div>
          <p className="mt-1 flex justify-between text-[13px] text-[#5B6785]"><span>{progress}/8 arrêts · selon ta position</span><span>{remaining} restants</span></p>
          <div className="mt-2 rounded-xl bg-white p-3">
            <p className="font-bold">Université · encore {remaining} arrêts</p>
            <p className="text-[14px] text-[#5B6785]">{search.from} → Université → {search.to}</p>
          </div>
          {imminent && <p className="mt-2 text-[13px] text-[#5B6785]">Rappel basé sur ton GPS, pas sur un bus localisé en temps réel. Vérifie les repères autour de toi.</p>}
        </div>
        <div className="mt-3 rounded-[20px] border border-[#E3E8F3] bg-white p-4">
          <h3 className="font-bold">Pour la suite</h3>
          <div className="mt-1">
            {itin.stops.slice(5, 7).map((s) => (
              <p key={s.id} className="flex items-center gap-3 py-2"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8EFFF]">•</span><span><span className="block font-semibold">{s.name}</span><span className="text-[14px] text-[#5B6785]">Point de montée</span></span></p>
            ))}
            <p className="mt-1 flex items-center gap-3 rounded-xl border border-[#F5A623] bg-[#FFFBEB] p-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F5A623] text-white">↓</span> <span><strong className="text-[#B26A00]">Université · DESCENDRE ICI</strong><span className="block text-[13px] text-[#B26A00]">Ton arrêt de destination</span></span></p>
          </div>
        </div>
        <div className="mt-3 rounded-[20px] border border-[#E3E8F3] bg-white p-4">
          <div className="flex items-center justify-between">
            <div><h3 className="font-bold">Aider la communauté</h3><p className="text-[13px] text-[#5B6785]">Partage anonyme pendant ce trajet</p></div>
            <button role="switch" aria-checked={share} onClick={() => setShare(!share)} className={`h-8 w-14 rounded-full p-1 transition ${share ? 'bg-[#1F5EFF]' : 'bg-[#E3E8F3]'}`}><span className={`block h-6 w-6 rounded-full bg-white transition ${share ? 'ml-auto' : ''}`} /></button>
          </div>
          {share && <p className="mt-2 inline-block rounded-full bg-[#E7F5ED] px-3 py-1 text-[14px] font-semibold text-[#12A150]">Position partagée</p>}
          <p className="mt-2 text-[13px] text-[#5B6785]">Désactivable à tout moment. Arrêt automatique en fin de trajet.</p>
        </div>
        <Link to="/fin-trajet" className="mt-3 flex h-14 w-full items-center justify-center rounded-full bg-[#0F1B3D] font-semibold text-white">Terminer le trajet 🎉</Link>
        <div className="mt-2 flex flex-wrap gap-1 pb-4">
          {['encours', 'gps-coupe', 'batterie', 'horsligne', 'attente'].map((e) => (
            <button key={e} onClick={() => setEtat(e)} className="rounded-full border border-[#E3E8F3] bg-white px-2 py-1 text-[11px]">Voir : {e}</button>
          ))}
        </div>
      </div>
      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0F1B3D66]" role="dialog" aria-modal="true" aria-label="Signalement rapide">
          <div className="max-h-[92dvh] w-full max-w-[480px] overflow-y-auto rounded-t-[24px] bg-white p-6 pb-8">
            {sheet === 'signaler' ? (
              <>
                <div className="mx-auto h-1.5 w-16 rounded-full bg-[#E3E8F3]" />
                <div className="mt-3 flex items-start justify-between">
                  <h2 className="text-[24px] font-bold">Signalement rapide</h2>
                  <button onClick={() => setSheet(null)} aria-label="Fermer" className="text-[28px] leading-none">×</button>
                </div>
                <p className="mt-1 text-[14px] text-[#5B6785]">Un changement à bord ? Ton retour aide toute la communauté ◼</p>
                <div className="mt-3 rounded-[20px] bg-[#E8EFFF] p-4">
                  <p className="font-bold">◼ Tata 24 · direction Université</p>
                  <p className="text-[14px] text-[#5B6785]">{search.from} → Université · trajet en cours</p>
                </div>
                <p className="mt-4 font-bold">Bus plein · quel niveau ?</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {([['peu', 'Peu rempli'], ['debout', 'Debout'], ['complet', 'Complet']] as const).map(([v, label]) => (
                    <button key={v} onClick={() => setNiveau(v)} aria-pressed={niveau === v} className={`rounded-2xl border p-3 text-center ${niveau === v ? 'border-[#1F5EFF] bg-[#E8EFFF] text-[#1F5EFF]' : 'border-[#E3E8F3] text-[#5B6785]'}`}>
                      <span className="block text-[18px] tracking-tight text-[#1F5EFF]">{v === 'peu' ? '◉' : v === 'debout' ? '◉◉' : '◉◉◉'}</span>
                      <span className="text-[13px] font-semibold">{label}{niveau === v && ' ✓'}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {['Retard', 'Arrêt déplacé', 'Ligne changée', 'Autre'].map((m) => (
                    <button key={m} onClick={() => setMotif(m)} aria-pressed={motif === m} className="flex h-14 items-center gap-3 rounded-2xl border border-[#E3E8F3] bg-white px-4 text-left font-medium text-[#0F1B3D]">
                      <span>{m === 'Retard' ? '🕐' : m === 'Arrêt déplacé' ? '📍' : m === 'Ligne changée' ? '⇅' : '✎'}</span>{m}<span className="ml-auto text-[20px] text-[#5B6785]">{motif === m ? '◉' : '○'}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-[13px] text-[#5B6785]">Ton signalement sera vérifié. Aucun point n&apos;est attribué avant validation.</p>
                <button onClick={() => setSheet('recu')} className="mt-3 flex h-14 w-full items-center justify-center rounded-full bg-[#1F5EFF] font-semibold text-white">Envoyer le signalement</button>
              </>
            ) : (
              <>
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F5C518] text-[24px]">◼</span>
                <h2 className="mt-3 text-[24px] font-bold leading-tight">Merci, ton signalement est reçu&nbsp;!</h2>
                <p className="mt-2 text-[15px] text-[#5B6785]">Tu aides les autres voyageurs à mieux préparer leur trajet.</p>
                <span className="mt-2 inline-block rounded-full bg-[#FFF6DB] px-3 py-1 text-[13px] font-semibold text-[#B26A00]">En attente de vérification</span>
                <div className="mt-3 rounded-[20px] bg-[#E8EFFF] p-4">
                  <p className="font-bold">Tata 24 · direction Université</p>
                  <p className="text-[14px] text-[#5B6785]">Bus plein · {niveau === 'complet' ? 'Complet' : niveau === 'debout' ? 'Debout' : 'Peu rempli'}{motif ? ` · ${motif}` : ''}</p>
                  <p className="text-[13px] text-[#5B6785]">Envoyé aujourd&apos;hui à 09:41</p>
                </div>
                <p className="mt-3 text-[14px] text-[#5B6785]">Le signalement sera vérifié avant toute mise à jour. Tu retrouveras son statut dans « Mes contributions ».</p>
                <div className="mt-2 rounded-[16px] border border-[#F5C518] p-3 text-[14px] font-medium">Aucun point attribué pour le moment. Les points seront ajoutés seulement après validation.</div>
                <button onClick={() => setSheet(null)} className="mt-3 flex h-14 w-full items-center justify-center rounded-full bg-[#1F5EFF] font-semibold text-white">Reprendre mon suivi</button>
                <Link to="/contribuer" className="mt-2 flex h-14 w-full items-center justify-center rounded-full border border-[#1F5EFF] font-semibold text-[#0B3BCC]">Voir mes contributions</Link>
              </>
            )}
          </div>
        </div>
      )}
      <BottomNav active="accueil" />
    </Phone>
  )
}
