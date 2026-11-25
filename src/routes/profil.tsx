import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { BottomNav, Phone } from '@/components/yoonu'
import { listContributions } from '@/server/yoonu'

export const Route = createFileRoute('/profil')({
  loader: () => listContributions(),
  component: Profil,
})

function Profil() {
  const serverContribs = Route.useLoaderData() as { id: string; type: string; message: string; status: string }[]
  const nav = useNavigate()
  const [email, setEmail] = useState<string | null>(null)
  useEffect(() => {
    try { setEmail(localStorage.getItem('yb-user')) } catch { /* ssr */ }
  }, [])
  return (
    <Phone>
      <div className="flex items-center gap-3 px-5 pt-2"><Link to="/accueil">←</Link><h1 className="text-[18px] font-bold">Profil</h1></div>
      <div className="bg-[#1F5EFF] px-5 py-6 text-white">
        {email ? (
          <>
            <p className="text-[13px] opacity-90">Connecté · {email}</p>
            <h2 className="mt-1 text-[22px] font-bold">Awa · Niveau 2</h2>
            <p>120 points validés · 3 contributions</p>
          </>
        ) : (
          <>
            <h2 className="text-[22px] font-bold">Salut, voyageur 👋</h2>
            <p>Connecte-toi pour suivre tes contributions et tes points.</p>
            <Link to="/connexion" className="mt-3 flex h-12 items-center justify-center rounded-full bg-white font-semibold text-[#0B3BCC]">Se connecter</Link>
          </>
        )}
      </div>
      <div className="space-y-3 px-5 py-4">
        <div className="rounded-[20px] border border-[#E3E8F3] bg-white p-4">
          <h3 className="font-bold">Contributions et statuts</h3>
          <div className="mt-2 space-y-2">
            {[
              { t: 'Tata 24 · parcours Castor → Université', s: 'validée · +60 pts', c: 'text-[#12A150] bg-[#E7F5ED]' },
              { t: 'Arrêt Liberté 6 déplacé ?', s: 'en vérification', c: 'text-[#B26A00] bg-[#FFF1D6]' },
              { t: 'Retard Tata 24 · 15 min', s: 'reçue', c: 'text-[#0B3BCC] bg-[#E8EFFF]' },
            ].map((c) => (
              <div key={c.t} className="flex items-center justify-between gap-2 rounded-xl bg-[#F6F8FB] p-3">
                <span className="text-[14px] font-medium">{c.t}</span>
                <span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${c.c}`}>{c.s}</span>
              </div>
            ))}
            {serverContribs.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl bg-[#F6F8FB] p-3">
                <span className="text-[14px] font-medium">{c.message.slice(0, 60)}</span>
                <span className="rounded-full bg-[#E8EFFF] px-2 py-0.5 text-[12px] font-semibold text-[#0B3BCC]">{c.status}</span>
              </div>
            ))}
          </div>
        </div>
        {email && (
          <button
            onClick={() => { try { localStorage.removeItem('yb-user') } catch { /* */ } setEmail(null); nav({ to: '/accueil' as never }) }}
            className="h-12 w-full rounded-full border border-[#E3E8F3] bg-white font-semibold text-[#5B6785]"
          >
            Se déconnecter
          </button>
        )}
      </div>
      <div className="flex-1" />
      <BottomNav active="profil" />
    </Phone>
  )
}
