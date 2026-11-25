import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Phone, PrimaryButton } from '@/components/yoonu'
import { submitContribution } from '@/server/yoonu'
import { useAction } from '@/lib/actions'

export const Route = createFileRoute('/proposer')({
  component: Proposer,
})

function Proposer() {
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [from, setFrom] = useState('Castor')
  const [to, setTo] = useState('Université')
  const [lineName, setLineName] = useState('Tata 24')
  const [detail, setDetail] = useState('')
  const [doneId, setDoneId] = useState<string | null>(null)
  const send = useAction(
    async () => await submitContribution({ data: { name: 'Awa', type: 'parcours', lineName, message: `${from} → ${to}. ${detail}` } }),
    { onSuccess: (r) => { setDoneId((r as { id: string }).id); setStep(2) } },
  )

  if (step === 2) {
    return (
      <Phone>
        <div className="px-6 pt-16 text-center">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#E7F5ED] text-3xl">✓</span>
          <h1 className="mt-4 text-[22px] font-bold">Proposition reçue !</h1>
          <p className="mt-2 text-[14px] text-[#5B6785]">Merci ! Notre équipe vérifie ton parcours {lineName} ({from} → {to}) avant publication. Tu gagnes des points dès validation.</p>
          <p className="mt-1 text-[12px] text-[#5B6785]">Réf : {doneId?.slice(0, 8)}</p>
          <div className="mt-4 space-y-2">
            <PrimaryButton onClick={() => nav({ to: '/profil' as never })}>Voir mes contributions</PrimaryButton>
            <Link to="/contribuer" className="flex h-14 items-center justify-center rounded-full border border-[#1F5EFF] font-semibold text-[#0B3BCC]">Retour Contribuer</Link>
          </div>
        </div>
      </Phone>
    )
  }

  return (
    <Phone>
      <div className="flex items-center gap-3 px-5 pt-2">
        <button onClick={() => (step === 0 ? nav({ to: '/contribuer' as never }) : setStep(0))}>←</button>
        <h1 className="text-[17px] font-bold">{step === 0 ? 'Proposer un parcours' : 'Précisions sur le bus'}</h1>
      </div>
      <div className="px-5 pt-4">
        {step === 0 && (
          <>
            <p className="text-[14px] text-[#5B6785]">Partage les arrêts que tu connais. Étape 1 sur 2.</p>
            <label className="mt-3 block text-[13px] font-semibold" htmlFor="from">Départ</label>
            <input id="from" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-xl border border-[#E3E8F3] bg-white p-3 outline-none focus:border-[#1F5EFF]" />
            <label className="mt-3 block text-[13px] font-semibold" htmlFor="to">Arrivée</label>
            <input id="to" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-xl border border-[#E3E8F3] bg-white p-3 outline-none focus:border-[#1F5EFF]" />
            <label className="mt-3 block text-[13px] font-semibold" htmlFor="stops">Arrêts dans l'ordre (un par ligne)</label>
            <textarea id="stops" value={detail} onChange={(e) => setDetail(e.target.value)} rows={4} placeholder="Castor Marché&#10;Liberté 6&#10;Université" className="mt-1 w-full rounded-xl border border-[#E3E8F3] bg-white p-3 outline-none focus:border-[#1F5EFF]" />
            <div className="mt-4"><PrimaryButton onClick={() => setStep(1)}>Continuer →</PrimaryButton></div>
          </>
        )}
        {step === 1 && (
          <>
            <p className="text-[14px] text-[#5B6785]">Précisions sur le bus. Étape 2 sur 2.</p>
            <label className="mt-3 block text-[13px] font-semibold" htmlFor="line">Nom de la ligne</label>
            <input id="line" value={lineName} onChange={(e) => setLineName(e.target.value)} className="mt-1 w-full rounded-xl border border-[#E3E8F3] bg-white p-3 outline-none focus:border-[#1F5EFF]" />
            <div className="mt-3 rounded-xl bg-[#E8EFFF] p-3 text-[13px]">Rappel : {from} → {to}. Dis ce que le receveur annonce.</div>
            <div className="mt-4 space-y-2 pb-6">
              <PrimaryButton onClick={() => send.run()}> {send.pending ? 'Envoi…' : 'Envoyer ma proposition'}</PrimaryButton>
              {send.error && <p className="text-[13px] text-red-600">{String(send.error)}</p>}
              <button onClick={() => setStep(0)} className="flex h-14 w-full items-center justify-center rounded-full border border-[#1F5EFF] font-semibold text-[#0B3BCC]">← Précédent</button>
            </div>
          </>
        )}
      </div>
    </Phone>
  )
}
