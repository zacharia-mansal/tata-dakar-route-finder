import { createFileRoute, Link } from '@tanstack/react-router'
import { BottomNav, FigmaIcon, Phone } from '@/components/yoonu'

export const Route = createFileRoute('/reglages')({
  component: Reglages,
})

const rows = [
  { to: '/info', title: 'Aide', sub: 'Lieux et sens du bus', icon: 'circle-help' },
  { to: '/suivi', title: 'Signaler un problème', sub: 'Information incorrecte', icon: 'flag' },
  { to: '/notifications', title: 'Notifications', sub: 'Alerte de descente, son et vibration', icon: 'circle-help' },
  { to: '/hors-ligne', title: 'Données hors ligne', sub: 'Enregistrements et espace utilisé', icon: 'circle-help' },
  { to: '/info', title: 'Vie privée', sub: 'Données et autorisations', icon: 'shield' },
  { to: '/suivi', title: 'Partage de position', sub: 'Vie privée · anonyme et optionnel', icon: 'circle-help' },
] as const

function Reglages() {
  return (
    <Phone>
      <div className="flex items-center gap-3 px-4 py-2">
        <Link to="/profil" className="flex h-12 w-12 items-center justify-center text-[22px] text-[#0F1B3D]" aria-label="Retour au profil"><FigmaIcon name="arrow-left" size={24} /></Link>
        <h1 className="text-[16px] font-semibold text-[#0F1B3D]">Réglages</h1>
      </div>
      <div className="flex flex-col gap-2 bg-[#1F5EFF] px-6 py-5" style={{ background: 'linear-gradient(90deg,#1F5EFF 0%,#1244C9 100%)' }}>
        <span className="w-fit rounded-full bg-[#F5C518] px-3 py-1 text-[12px] font-bold text-[#0F1B3D]">
          <FigmaIcon name="bus-stop" size={16} /> Montez sans vous perdre
        </span>
        <h2 className="text-[22px] font-bold text-white">Tes préférences</h2>
        <p className="text-[14px] text-white/75">Personnalise ton expérience Yoonu Bus</p>
      </div>
      <div className="flex flex-col gap-5 p-6">
        <section className="flex flex-col gap-3">
          <p className="text-[13px] font-bold uppercase tracking-[0.5px] text-[#5B6785]">Langue / Language</p>
          <div className="flex flex-col gap-2 rounded-[20px] border border-[#E3E8F3] bg-white p-4 shadow-[0px_4px_16px_0px_rgba(31,94,255,0.08)]">
            <p className="flex items-center gap-3 rounded-[14px] border-2 border-[#1F5EFF] bg-[#E8EFFF] px-4 py-2 font-semibold text-[#1F5EFF]">
              <FigmaIcon name="circle-dot" size={16} /> Français / French
            </p>
            <p className="flex items-center gap-3 rounded-[14px] border border-[#E3E8F3] bg-white px-4 py-2 text-[#0F1B3D]">
              <FigmaIcon name="circle" size={16} /> Anglais / English
            </p>
          </div>
        </section>
        <section className="flex flex-col gap-3">
          <p className="text-[13px] font-bold uppercase tracking-[0.5px] text-[#5B6785]">Assistance</p>
          <div className="flex flex-col rounded-[20px] border border-[#E3E8F3] bg-white p-2 shadow-[0px_4px_16px_0px_rgba(31,94,255,0.08)]">
            {rows.map((r, i) => (
              <div key={r.title}>
                <Link to={r.to as never} className="flex items-center gap-3 rounded-[16px] p-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E8EFFF]"><FigmaIcon name={r.icon} size={24} /></span>
                  <span className="flex-1">
                    <span className="block text-[16px] font-semibold text-[#0F1B3D]">{r.title}</span>
                    <span className="block text-[14px] text-[#5B6785]">{r.sub}</span>
                  </span>
                  <FigmaIcon name="chevron-right" size={18} />
                </Link>
                {i < rows.length - 1 && <div className="h-px bg-[#E3E8F3]" />}
              </div>
            ))}
          </div>
        </section>
        <div className="flex flex-col gap-2 rounded-[20px] border border-[#F5C51866] bg-[#FFFBEA] p-5 shadow-[0px_4px_12px_0px_rgba(245,197,24,0.13)]">
          <p className="text-[16px] font-semibold text-[#0F1B3D]">À savoir</p>
          <p className="text-[14px] leading-[22px] text-[#5B6785]">Recherche sans compte · contribution avec connexion.</p>
          <p className="text-[14px] leading-[22px] text-[#5B6785]">GPS facultatif · départ manuel possible.</p>
          <p className="text-[14px] leading-[22px] text-[#5B6785]">
            Photos facultatives et privées. Métadonnées de localisation supprimées.
          </p>
          <p className="text-[14px] leading-[22px] text-[#5B6785]">
            Partage de position&nbsp;: anonyme, optionnel, uniquement pendant un trajet actif et désactivable à tout
            moment.
          </p>
        </div>
        <p className="text-center text-[12px] text-[#5B6785]">
          Yoonu Bus · Android
          <br />
          Conçu pour Dakar
        </p>
      </div>
      <BottomNav active="profil" />
    </Phone>
  )
}
