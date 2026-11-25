import { createFileRoute, Link } from '@tanstack/react-router'
import { BottomNav, Phone } from '@/components/yoonu'

export const Route = createFileRoute('/info')({
  component: Info,
})
function Info() {
  return (
    <Phone>
      <div className="flex items-center gap-3 px-5 pt-2"><Link to="/ligne">←</Link><h1 className="text-[17px] font-bold">D'où vient cette info ?</h1></div>
      <div className="space-y-3 px-5 py-4">
        <div className="rounded-[20px] bg-[#E7F5ED] p-4">
          <p className="font-bold text-[#12A150]">✓ Trajet vérifié</p>
          <p className="mt-1 text-[14px]">Tata 24 · Castor → Université vérifié par 12 voyageurs et notre équipe le 12 nov. 2026.</p>
        </div>
        <div className="rounded-[20px] border border-[#E3E8F3] bg-white p-4">
          <h2 className="font-bold">Nos sources</h2>
          <ul className="mt-1 list-disc pl-5 text-[14px] text-[#5B6785]">
            <li>Observations de la communauté (anonymes)</li>
            <li>Vérification terrain Dakar</li>
            <li>Receveurs et arrêts annoncés</li>
          </ul>
        </div>
        <div className="rounded-[20px] border border-[#F5B800] bg-[#FFFBEB] p-4 text-[14px]">
          On ne localise jamais les bus. Seule ta position compte, avec ton accord, pour t'alerter au bon arrêt.
        </div>
        <Link to="/partage" className="flex h-14 items-center justify-center rounded-full bg-[#1F5EFF] font-semibold text-white">Partager ce trajet</Link>
      </div>
      <BottomNav active="accueil" />
    </Phone>
  )
}
