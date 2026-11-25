import { createFileRoute, Link } from '@tanstack/react-router'
import { BottomNav, Phone, PrimaryButton, SecondaryButton } from '@/components/yoonu'

export const Route = createFileRoute('/fin-trajet')({
  component: FinTrajet,
})

function FinTrajet() {
  return (
    <Phone>
      <div className="flex items-center gap-4 px-6 py-2">
        <Link to="/suivi" search={{ from: 'Castor', to: 'ISM Dakar', etat: 'encours' } as never} className="text-[20px] text-[#0F1B3D]">←</Link>
        <h1 className="text-[16px] font-semibold text-[#0F1B3D]">Trajet terminé</h1>
      </div>
      <div className="flex flex-col gap-5 p-6">
        <div className="flex justify-center">
          <span className="flex h-[104px] w-[104px] items-center justify-center rounded-full bg-[#FFF6DB] text-[44px]">💛</span>
        </div>
        <h2 className="text-[24px] font-bold leading-[36px] tracking-[-0.5px] text-[#0F1B3D]">
          Merci d&apos;avoir fait un bout de chemin avec nous&nbsp;!
        </h2>
        <p className="text-[14px] font-medium leading-[21px] text-[#5B6785]">
          Ton partage anonyme a aidé la communauté pendant ce trajet. Merci pour ce coup de main.
        </p>
        <div className="flex flex-col gap-3 rounded-[20px] border border-[#E3E8F3] bg-[#E7F5ED] p-4">
          <span className="w-fit rounded-full bg-[#E3E8F3] px-3 py-1 text-[12px] font-medium text-[#5B6785]">
            Partage arrêté automatiquement
          </span>
          <p className="text-[14px] font-semibold text-[#0F1B3D]">Ton trajet est fini, le partage aussi</p>
          <p className="text-[12px] text-[#5B6785]">Aucune position n&apos;est envoyée après la fin du trajet.</p>
        </div>
        <div className="flex flex-col gap-3 rounded-[20px] border border-[#E3E8F3] bg-[#E8EFFF] p-4">
          <p className="text-[14px] font-semibold text-[#0F1B3D]">Tata 24 · direction Université</p>
          <p className="text-[14px] font-medium text-[#5B6785]">Castor → Université → ISM Dakar</p>
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E8EFFF] text-[14px] font-semibold text-[#0F1B3D]">•</span>
            <span>
              <span className="block text-[16px] font-semibold text-[#0F1B3D]">Université</span>
              <span className="block text-[14px] text-[#5B6785]">Point de descente</span>
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-[20px] border border-[#E3E8F3] bg-white p-4">
          <p className="text-[14px] font-semibold text-[#0F1B3D]">Comment s&apos;est passé le trajet&nbsp;?</p>
          <p className="text-[14px] font-medium text-[#5B6785]">
            Retrouve le retour sur le trajet pour confirmer la ligne, le sens et le bon arrêt.
          </p>
          <p className="text-[12px] text-[#5B6785]">Ton avis sera vérifié avant toute modification.</p>
        </div>
        <PrimaryButton to="/retour">Donner mon avis sur le trajet</PrimaryButton>
        <SecondaryButton to="/accueil">Retour à l&apos;accueil</SecondaryButton>
      </div>
      <div className="flex-1" />
      <BottomNav active="accueil" />
    </Phone>
  )
}
