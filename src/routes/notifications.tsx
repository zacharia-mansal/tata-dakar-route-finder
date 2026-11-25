import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { BottomNav, Phone } from '@/components/yoonu'

export const Route = createFileRoute('/notifications')({
  validateSearch: (s: Record<string, unknown>) => ({
    etat: typeof s.etat === 'string' ? s.etat : 'auto',
  }),
  component: Notifications,
})

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`h-9 w-[60px] shrink-0 rounded-full p-1 transition ${on ? 'bg-[#1F5EFF]' : 'bg-[#D0D5DD]'}`}
    >
      <span className={`block h-7 w-7 rounded-full bg-white shadow transition ${on ? 'ml-auto' : ''}`} />
    </button>
  )
}

function Notifications() {
  const search = Route.useSearch() as { etat: string }
  const refusee = search.etat === 'refusee'
  const [alerte, setAlerte] = useState(true)
  const [son, setSon] = useState(true)
  const [vibration, setVibration] = useState(true)
  const [avant, setAvant] = useState<1 | 2>(2)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('yb-notifs')
      if (raw) {
        const p = JSON.parse(raw) as { alerte: boolean; son: boolean; vibration: boolean; avant: 1 | 2 }
        setAlerte(p.alerte)
        setSon(p.son)
        setVibration(p.vibration)
        setAvant(p.avant)
      }
    } catch {
      /* défauts */
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('yb-notifs', JSON.stringify({ alerte, son, vibration, avant }))
    } catch {
      /* stockage indisponible */
    }
  }, [alerte, son, vibration, avant])

  if (refusee) {
    return (
      <Phone>
        <div className="flex items-center gap-4 px-6 py-2">
          <Link to="/reglages" className="text-[20px] text-[#0F1B3D]">←</Link>
          <h1 className="text-[20px] font-bold text-[#0F1B3D]">Notifications</h1>
        </div>
        <div className="flex flex-col gap-5 p-6">
          <div className="flex justify-center">
            <span className="flex h-[104px] w-[104px] items-center justify-center rounded-full bg-[#FFF6DB] text-[44px]">🔔</span>
          </div>
          <h2 className="text-[24px] font-bold leading-tight text-[#0F1B3D]">Tes trajets restent accessibles</h2>
          <p className="text-[15px] text-[#5B6785]">
            Les notifications sont refusées sur ton téléphone. Tu peux toujours consulter ton trajet et suivre ta
            position dans l&apos;application.
          </p>
          <div className="flex flex-col gap-3 rounded-[20px] border border-[#F5C518] bg-[#FFFBEA] p-4">
            <span className="w-fit rounded-full bg-[#E3E8F3] px-3 py-1 text-[12px] font-medium text-[#5B6785]">
              Autorisation refusée
            </span>
            <p className="font-semibold text-[#0F1B3D]">Pas d&apos;alerte de descente sur le téléphone</p>
            <p className="text-[14px] text-[#5B6785]">
              Les rappels, le son et la vibration ne pourront pas te prévenir via une notification.
            </p>
          </div>
          <button
            type="button"
            onClick={() => alert('Ouvre les réglages du téléphone, puis Yoonu Bus, puis Notifications.')}
            className="flex h-14 w-full items-center justify-center rounded-full bg-[#1F5EFF] px-6 text-[16px] font-semibold text-white"
          >
            Ouvrir les réglages du téléphone
          </button>
          <p className="text-[14px] text-[#5B6785]">
            Dans les réglages de Yoonu Bus, autorise les notifications si tu le souhaites. Aucun changement n&apos;est
            fait ici.
          </p>
          <div className="rounded-[20px] border border-[#E3E8F3] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-[#0F1B3D]">Alerte de descente</p>
                <p className="text-[14px] text-[#5B6785]">Indisponible tant que l&apos;autorisation est refusée.</p>
              </div>
              <span className="h-9 w-[60px] rounded-full bg-[#D0D5DD] p-1 opacity-60">
                <span className="block h-7 w-7 rounded-full bg-white" />
              </span>
            </div>
            <p className="mt-2 text-[14px] text-[#5B6785]">
              Même avec les notifications autorisées, le rappel dépend d&apos;un GPS actif et suffisamment précis.
            </p>
          </div>
          <div className="rounded-[20px] bg-[#E8EFFF] p-4">
            <p className="font-semibold text-[#0F1B3D]">Ton trajet, sans notifications</p>
            <p className="mt-1 text-[14px] text-[#5B6785]">Tata 24 · Castor → Université → ISM Dakar</p>
            <p className="mt-2 text-[14px] text-[#5B6785]">
              Consulte les arrêts dans le suivi et demande confirmation au receveur pour descendre à Université.
            </p>
          </div>
          <Link
            to="/parcours"
            search={{ from: 'Castor', to: 'ISM Dakar' } as never}
            className="flex h-14 w-full items-center justify-center rounded-full border border-[#1F5EFF] bg-white px-6 text-[16px] font-semibold text-[#0B3BCC]"
          >
            Consulter mon trajet
          </Link>
          <Link to="/notifications" search={{ etat: undefined } as never} className="text-center text-[14px] font-semibold text-[#0B3BCC]">
            Voir l&apos;écran « autorisées » →
          </Link>
        </div>
        <BottomNav active="accueil" />
      </Phone>
    )
  }

  return (
    <Phone>
      <div className="flex items-center gap-4 px-6 py-2">
        <Link to="/reglages" className="text-[20px] text-[#0F1B3D]">←</Link>
        <h1 className="text-[20px] font-bold text-[#0F1B3D]">Notifications</h1>
      </div>
      <div className="-mx-0 bg-[#1F5EFF] px-6 py-6">
        <h2 className="text-[26px] font-bold leading-tight text-white">On te prévient au bon moment</h2>
        <p className="mt-2 text-[16px] text-white/90">Choisis tes rappels pour voyager plus sereinement.</p>
      </div>
      <div className="flex flex-col gap-4 bg-[#F6F8FB] p-6">
        <div className="rounded-[20px] border border-[#E3E8F3] bg-white p-4">
          <p className="text-[17px] font-bold text-[#0F1B3D]">Autorisation du téléphone</p>
          <span className="mt-2 inline-block rounded-full bg-[#E7F5ED] px-3 py-1 text-[14px] font-semibold text-[#12A150]">
            Notifications autorisées
          </span>
          <p className="mt-2 text-[14px] text-[#5B6785]">
            Tu peux modifier cette autorisation dans les réglages du téléphone.
          </p>
        </div>
        <div className="rounded-[20px] border border-[#E3E8F3] bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[17px] font-bold text-[#0F1B3D]">Alerte de descente</p>
              <p className="mt-1 text-[14px] text-[#5B6785]">Un rappel pour te préparer à descendre.</p>
            </div>
            <Toggle on={alerte} onClick={() => setAlerte(!alerte)} label="Alerte de descente" />
          </div>
          <p className="mt-4 text-[17px] font-bold text-[#0F1B3D]">Me rappeler avant l&apos;arrêt</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {([1, 2] as const).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={avant === n}
                onClick={() => setAvant(n)}
                className={`h-14 rounded-full text-[16px] font-bold ${
                  avant === n ? 'bg-[#1F5EFF] text-white' : 'border border-[#E3E8F3] bg-white text-[#5B6785]'
                }`}
              >
                {n} arrêt{n > 1 ? 's' : ''}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[14px] text-[#5B6785]">Pour le trajet actif uniquement.</p>
        </div>
        <div className="rounded-[20px] border border-[#E3E8F3] bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[17px] font-bold text-[#0F1B3D]">Son</p>
              <p className="mt-1 text-[14px] text-[#5B6785]">Un signal sonore pour ton rappel.</p>
            </div>
            <Toggle on={son} onClick={() => setSon(!son)} label="Son" />
          </div>
          <div className="my-3 h-px bg-[#E3E8F3]" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[17px] font-bold text-[#0F1B3D]">Vibration</p>
              <p className="mt-1 text-[14px] text-[#5B6785]">Une vibration en complément du son.</p>
            </div>
            <Toggle on={vibration} onClick={() => setVibration(!vibration)} label="Vibration" />
          </div>
        </div>
        <div className="rounded-[20px] border border-[#F5C518] bg-[#FFFBEA] p-4">
          <p className="text-[17px] font-bold text-[#0F1B3D]">Le rappel dépend de ton GPS</p>
          <p className="mt-2 text-[15px] font-medium text-[#5B6785]">
            Le GPS doit être actif pour repérer ton approche de l&apos;arrêt. Si le GPS est coupé ou imprécis,
            l&apos;alerte de descente n&apos;est pas garantie.
          </p>
          <p className="mt-3 text-[14px] text-[#5B6785]">
            Le mode silencieux et l&apos;économie de batterie du téléphone peuvent limiter le son ou les alertes.
          </p>
        </div>
        <p className="text-[14px] text-[#5B6785]">
          On suit ta position personnelle, jamais celle du bus. Garde aussi les repères du parcours à l&apos;œil.
        </p>
        <Link to="/notifications" search={{ etat: 'refusee' } as never} className="text-center text-[13px] font-semibold text-[#5B6785]">
          Voir l&apos;état « autorisation refusée » →
        </Link>
      </div>
      <BottomNav active="accueil" />
    </Phone>
  )
}
