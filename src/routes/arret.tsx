import { createFileRoute, Link } from '@tanstack/react-router'
import { BottomNav, Phone } from '@/components/yoonu'

export const Route = createFileRoute('/arret')({
  component: Arret,
})
function Arret() {
  return (
    <Phone>
      <div className="flex items-center gap-3 px-5 pt-2"><Link to="/ligne">←</Link><h1 className="text-[17px] font-bold">Arrêt Université</h1></div>
      <div className="px-5 pt-3">
        <div className="rounded-[20px] bg-[#FFF8EC] p-4">
          <p className="text-[13px] font-semibold text-[#B26A00]">📍 Sicap Liberté · arrêt Tata 24</p>
          <h2 className="text-[22px] font-bold">Université UCAD</h2>
          <p className="text-[14px] text-[#5B6785]">Descends ici pour l'ISM Dakar · 3 min à pied. Annoncé par le receveur « Université ».</p>
        </div>
        <h3 className="mt-4 font-bold">Lieux sponsorisés à côté</h3>
        {[
          { n: 'Café Touba Chez Awa', d: 'À 1 min · jus et café' },
          { n: 'Librairie Sicap', d: 'À 2 min · fournitures' },
          { n: 'Pharmacie Liberté', d: 'À 4 min · ouverte 7j/7' },
        ].map((l) => (
          <div key={l.n} className="mt-2 flex items-center gap-3 rounded-[16px] border border-[#E3E8F3] bg-white p-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF1D6]">★</span>
            <span><span className="block font-semibold">{l.n}</span><span className="text-[13px] text-[#5B6785]">{l.d}</span></span>
          </div>
        ))}
        <Link to="/info" className="mt-3 block rounded-[16px] border border-[#E3E8F3] bg-white p-3 text-center text-[13px] font-semibold text-[#0B3BCC]">D'où vient cette info ? →</Link>
        <div className="h-4" />
      </div>
      <BottomNav active="enregistres" />
    </Phone>
  )
}
