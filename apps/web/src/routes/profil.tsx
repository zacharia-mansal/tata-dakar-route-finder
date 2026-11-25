import { createFileRoute, Link } from '@tanstack/react-router'
import { BottomNav, FigmaIcon, Phone } from '@/components/yoonu'
import { listContributions } from '@/server/yoonu'

type Contribution = { id: string; type: string; message: string; status: string }

export const Route = createFileRoute('/profil')({ loader: () => listContributions(), component: Profil })

function Profil() {
  const contributions = Route.useLoaderData() as Contribution[]
  return (
    <Phone>
      <div className="flex items-center gap-3 px-5 pt-2"><Link to="/accueil" aria-label="Retour à l’accueil"><FigmaIcon name="arrow-left" size={24} /></Link><h1 className="text-[18px] font-bold">Profil</h1></div>
      <div className="bg-[#1F5EFF] px-5 py-6 text-white">
        <h2 className="text-[22px] font-bold">Ton espace Yoonu Bus</h2>
        <p className="mt-1">Tes informations réelles apparaîtront ici lorsque ton compte sera connecté.</p>
      </div>
      <div className="space-y-3 px-5 py-4">
        <section className="rounded-[20px] border border-[#E3E8F3] bg-white p-4">
          <h2 className="font-bold">Contributions</h2>
          {contributions.length === 0 ? (
            <p className="mt-2 text-[14px] text-[#5B6785]">Aucune contribution enregistrée pour ce compte.</p>
          ) : contributions.map((item) => (
            <article key={item.id} className="mt-2 rounded-xl bg-[#F6F8FB] p-3">
              <p className="text-[14px] font-medium">{item.message.slice(0, 160)}</p>
              <p className="mt-1 text-[12px] text-[#5B6785]">{item.type} · {item.status}</p>
            </article>
          ))}
        </section>
        <Link to="/contribuer" className="flex h-14 items-center justify-center rounded-full border border-[#1F5EFF] font-semibold text-[#0B3BCC]">Contribuer bientôt disponible</Link>
      </div>
      <BottomNav active="profil" />
    </Phone>
  )
}
