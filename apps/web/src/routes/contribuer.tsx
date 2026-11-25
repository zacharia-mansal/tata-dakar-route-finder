import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { BottomNav, Phone, PrimaryButton } from '@/components/yoonu'
import { submitContribution } from '@/server/yoonu'
import { useAction } from '@/lib/actions'

export const Route = createFileRoute('/contribuer')({
  component: Contribuer,
})

function Contribuer() {
  const [connected, setConnected] = useState(true)
  const [showSignal, setShowSignal] = useState(false)
  const [msg, setMsg] = useState('')
  const [ok, setOk] = useState(false)
  const send = useAction(async () => await submitContribution({ data: { name: 'Awa', type: 'signalement', message: msg || 'Retard signalé' } }), {
    onSuccess: () => setOk(true),
  })

  if (!connected) {
    return (
      <Phone>
        <div className="flex items-center gap-3 px-5 pt-2"><Link to="/accueil">←</Link><h1 className="text-[18px] font-bold">Contribuer</h1></div>
        <div className="bg-[#1F5EFF] px-5 py-6 text-white">
          <h2 className="text-[22px] font-bold">Ensemble, on connaît le chemin</h2>
          <p>Connecte-toi pour proposer et suivre tes contributions.</p>
        </div>
        <div className="px-5 py-6">
          <div className="rounded-[20px] border border-[#E3E8F3] bg-white p-5 text-center">
            <p className="font-bold">Connexion requise pour contribuer</p>
            <p className="mt-1 text-[14px] text-[#5B6785]">On vérifie chaque info avant publication.</p>
            <Link to="/connexion" className="mt-3 flex h-14 items-center justify-center rounded-full bg-[#1F5EFF] font-semibold text-white">Se connecter</Link>
            <button onClick={() => setConnected(true)} className="mt-2 text-[13px] text-[#5B6785] underline">Voir l'aperçu connecté</button>
          </div>
        </div>
        <div className="flex-1" />
        <BottomNav active="contribuer" />
      </Phone>
    )
  }

  return (
    <Phone>
      <div className="flex items-center gap-3 px-5 pt-2">
        <Link to="/accueil">←</Link><h1 className="text-[18px] font-bold">Contribuer</h1>
        <button onClick={() => setConnected(false)} className="ml-auto text-[12px] text-[#5B6785] underline">Voir non-connecté</button>
      </div>
      <div className="bg-[#1F5EFF] px-5 py-6 text-white">
        <span className="rounded-full bg-[#F5B800] px-3 py-1 text-[13px] font-bold text-[#0F1B3D]">👥 La communauté</span>
        <h2 className="mt-2 text-[24px] font-bold leading-tight">Ensemble, on connaît le chemin</h2>
        <p>Un petit geste pour toi, un grand repère pour Dakar.</p>
      </div>
      <div className="space-y-3 px-5 py-4">
        <div className="rounded-[20px] bg-[#E8EFFF] p-4">
          <span className="rounded-full bg-[#FFF1D6] px-3 py-1 text-[13px] font-semibold text-[#B26A00]">Contributeur · niveau 2</span>
          <p className="mt-2 text-[17px] font-bold">120 points validés · Merci Awa !</p>
          <p className="text-[14px] text-[#5B6785]">Les points sont attribués uniquement après validation.</p>
        </div>
        <Link to="/proposer" className="flex items-center gap-3 rounded-[20px] border border-[#E3E8F3] bg-white p-4 text-[#0F1B3D]">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8EFFF] text-2xl">⊞</span>
          <span className="flex-1"><span className="block text-[17px] font-bold">Proposer un parcours</span><span className="text-[14px] text-[#5B6785]">Partage les arrêts que tu connais.</span><span className="block text-[13px] text-[#5B6785]">Parcours → précisions sur le bus → proposition reçue</span></span><span>›</span>
        </Link>
        <button onClick={() => setShowSignal(!showSignal)} className="flex w-full items-center gap-3 rounded-[20px] border border-[#E3E8F3] bg-white p-4 text-left">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8EFFF] text-2xl">⚠</span>
          <span className="flex-1"><span className="block text-[17px] font-bold">Signaler une info</span><span className="text-[14px] text-[#5B6785]">Un retard, un arrêt déplacé ou une ligne changée ?</span></span><span>›</span>
        </button>
        {showSignal && (
          <div className="rounded-[20px] border border-[#1F5EFF] bg-white p-4">
            <label className="text-[13px] font-semibold" htmlFor="sig">Ton signalement</label>
            <textarea id="sig" value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} placeholder="Ex. Tata 24 en retard de 15 min à Liberté 6" className="mt-1 w-full rounded-xl border border-[#E3E8F3] p-3 outline-none focus:border-[#1F5EFF]" />
            <div className="mt-2"><PrimaryButton onClick={() => send.run()}> {send.pending ? 'Envoi…' : ok ? '✓ Signalement envoyé — merci !' : 'Envoyer le signalement'}</PrimaryButton></div>
            {send.error && <p className="mt-1 text-[13px] text-red-600">{String(send.error)}</p>}
          </div>
        )}
        <div className="flex items-center gap-3 rounded-[20px] border border-[#E3E8F3] bg-white p-4 text-[#0F1B3D]">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8EFFF] text-2xl">🚌</span>
          <span className="flex-1"><span className="block text-[17px] font-bold">Aider à bord</span><span className="text-[14px] text-[#5B6785]">Partage ce que tu observes pendant ton trajet.</span><span className="mt-1 inline-block rounded-full bg-[#E7F5ED] px-3 py-0.5 text-[13px] font-semibold text-[#12A150]">Activé</span></span><span>›</span>
        </div>
        <Link to="/profil" className="flex items-center gap-3 rounded-[20px] border border-[#E3E8F3] bg-white p-4 text-[#0F1B3D]">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8EFFF] text-2xl">☰</span>
          <span className="flex-1"><span className="block text-[17px] font-bold">Mes contributions</span><span className="text-[14px] text-[#5B6785]">120 points · consulte tes statuts dans Profil</span></span><span>›</span>
        </Link>
        <div className="rounded-[20px] border border-[#F5B800] bg-[#FFFBEB] p-4">
          <p className="text-[15px] font-medium">◼ Chaque information est vérifiée avant publication. Merci de prendre soin du trajet des autres.</p>
        </div>
        <Link to="/info" className="block text-center text-[13px] font-semibold text-[#0B3BCC] underline">D'où vient cette info ?</Link>
      </div>
      <BottomNav active="contribuer" />
    </Phone>
  )
}
