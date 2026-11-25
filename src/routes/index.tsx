import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { BottomNav, Phone, PrimaryButton, SchematicMap } from '@/components/yoonu'

export const Route = createFileRoute('/')({
  component: Onboarding,
})

function Onboarding() {
  const [step, setStep] = useState(0)
  const nav = useNavigate()
  const goHome = () => nav({ to: '/accueil' as never })

  return (
    <Phone>
      {step === 0 && (
        <>
          <div className="relative h-[300px] overflow-hidden bg-[#0F1B3D]">
            <img src="https://files.monstarx.app/0a9472isok/public/design/img-fdab5420b2791a0b.png" alt="Bus Yoonu" className="absolute inset-x-0 top-[60px] h-[240px] w-full object-cover" />
            <div className="absolute inset-x-0 top-0 h-[100px] bg-gradient-to-b from-[#0F1B3D] to-transparent" />
            <div className="absolute left-5 top-2 flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5A623] text-xl">🚌</span>
              <span className="rounded-[10px] bg-white px-2 py-1 leading-none">
                <span className="text-[16px] font-bold text-[#0F1B3D]">yoonu</span>
                <span className="text-[16px] font-bold text-[#3A8F3F]">bus</span>
                <span className="block text-[9px] font-normal text-[#5B6785]">Montez sans vous perdre</span>
              </span>
            </div>
            <button onClick={goHome} className="absolute right-5 top-2 rounded-full px-4 py-2 text-[13px] font-semibold text-white">Passer</button>
          </div>
          <div className="flex flex-1 flex-col gap-5 rounded-t-[28px] bg-[#F6F8FB] px-6 pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-7 rounded-full bg-[#0F1B3D]" />
                <span className="h-2 w-2 rounded-full bg-[#E3E8F3]" />
                <span className="h-2 w-2 rounded-full bg-[#E3E8F3]" />
              </div>
              <span className="text-[12px] font-medium text-[#5B6785]">Étape 1 sur 3</span>
            </div>
            <div>
              <h1 className="text-[28px] font-bold leading-[42px] tracking-tight">D'où tu pars ?<br />Où tu vas ?</h1>
              <p className="mt-1 text-[14px] text-[#5B6785]">Dis-nous ton départ et ta destination — on s'occupe du reste. 🗺️</p>
            </div>
            <div className="rounded-[20px] border border-[#E3E8F3] bg-white p-4">
              <div className="flex items-center gap-3 rounded-[14px] border border-[#E3E8F3] bg-[#F6F8FB] px-3 py-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E8EFFF]"><span className="h-2.5 w-2.5 rounded-full bg-[#1F5EFF]" /></span>
                <span><span className="block text-[10px] font-semibold uppercase tracking-wide text-[#5B6785]">Départ</span><span className="text-[14px] text-[#5B6785]">Ex. Castor, Liberté 6…</span></span>
              </div>
              <div className="my-2 flex justify-center"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5A623] text-white">⇄</span></div>
              <div className="flex items-center gap-3 rounded-[14px] border border-[#1F5EFF] bg-[#E8EFFF] px-3 py-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1F5EFF] text-white text-[12px]">◉</span>
                <span><span className="block text-[10px] font-semibold uppercase tracking-wide text-[#5B6785]">Destination</span><span className="text-[14px] text-[#5B6785]">Où vas-tu ?</span></span>
              </div>
              <p className="pt-3 text-[13px] text-[#5B6785]">🟡 Tu peux taper un quartier, un lieu connu ou un arrêt de bus.</p>
            </div>
            <p className="text-[12px] text-[#5B6785]">Ensuite : <strong className="text-[#0F1B3D]">choisir le bon bus</strong> et <strong className="text-[#0F1B3D]">suivre ton arrêt</strong> →</p>
          </div>
          <div className="bg-[#F6F8FB] px-6 pb-2 pt-2">
            <PrimaryButton onClick={() => setStep(1)} className="!bg-[#0F1B3D]">Suivant →</PrimaryButton>
            <button onClick={goHome} className="mt-1 h-11 w-full font-semibold text-[#5B6785]">Passer l'introduction</button>
          </div>
        </>
      )}
      {step === 1 && (
        <>
          <div className="bg-[#FFF8EC] px-6 pb-4 pt-2 text-center">
            <div className="mb-2 flex justify-start"><button onClick={goHome} className="rounded-full bg-[#0F1B3D14] px-4 py-2 text-[13px] font-semibold text-[#0F1B3D]">Passer</button></div>
            <div className="relative mx-auto flex h-[150px] w-[200px] items-center justify-center rounded-full bg-[#F5A62320]">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#0F1B3D] text-4xl text-white">🚌</span>
              <span className="absolute -bottom-1 flex items-center gap-1 rounded-lg border border-[#12A15030] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#12A150] shadow"><span className="h-1.5 w-1.5 rounded-full bg-[#12A150]" />Montée ici</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-white">
              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#F5A623]">A</span>
              <span className="h-0.5 w-[100px] rounded-full bg-[#F5A62350]" />
              <span>🚌</span>
              <span className="h-0.5 w-[100px] rounded-full bg-[#1F5EFF50]" />
              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#0F1B3D]">B</span>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-4 rounded-t-[28px] bg-[#F6F8FB] px-6 pt-6">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5B6785]">Étape 2 sur 3 ● ● ●</p>
            <h1 className="text-[30px] font-bold leading-[1.3]">Choisis ton bus<br />et repère ton arrêt.</h1>
            <p className="text-[13px] text-[#5B6785]">On te montre quelle ligne prendre, où monter et où descendre — sans te perdre.</p>
            <div className="rounded-[20px] border border-[#E3E8F3] bg-white p-5">
              <p className="text-[14px] font-semibold">TRAJET DIRECT</p>
              <p className="mt-1 text-[18px] font-bold">Tata 24 · direction Université</p>
              <span className="mt-2 inline-block rounded-lg bg-[#E7F5ED] px-2 py-0.5 text-[12px] font-medium text-[#12A150]">Vérifié</span>
              <p className="mt-2 text-[14px] font-medium">Castor → Université → ISM Dakar</p>
              <p className="text-[14px] text-[#5B6785]">Descends à l'arrêt « Université »</p>
              <p className="text-[14px] text-[#5B6785]">Marche 3 min jusqu'à l'ISM</p>
              <div className="mt-3"><PrimaryButton onClick={() => setStep(2)}>Choisir ce trajet</PrimaryButton></div>
            </div>
          </div>
          <div className="space-y-2 bg-[#F6F8FB] px-6 pb-2">
            <PrimaryButton onClick={() => setStep(2)}>Suivant →</PrimaryButton>
            <button onClick={() => setStep(0)} className="flex h-14 w-full items-center justify-center rounded-full border border-[#1F5EFF] font-semibold text-[#0B3BCC]">← Précédent</button>
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <div className="relative bg-[#E8EFFF] px-6 pb-16 pt-10">
            <button onClick={goHome} className="absolute right-6 top-2 rounded-full border border-[#E3E8F3] bg-white px-4 py-1.5 text-[13px] font-semibold text-[#0B3BCC]">Passer</button>
            <div className="relative rounded-[20px] bg-white p-6 shadow-lg">
              <div className="absolute -top-3 right-6 flex items-center gap-1 rounded-full bg-[#F5A623] px-3 py-1 text-[12px] font-bold text-white">🔔 2 arrêts restants</div>
              <p className="text-[12px] text-[#5B6785]">✓ Castor Marché</p>
              <div className="my-1 ml-1 h-4 w-0.5 bg-[#12A150]" />
              <p className="text-[13px] font-bold text-[#1F5EFF]">🚌 Liberté 6 <span className="rounded bg-[#E8EFFF] px-1 text-[10px]">Tu es ici</span></p>
              <div className="my-1 ml-1 h-4 w-0.5 bg-[#E3E8F3]" />
              <p className="text-[12px] text-[#5B6785]">● Université UCAD</p>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-4 rounded-t-[28px] bg-[#F6F8FB] px-6 pt-6">
            <div>
              <h1 className="text-[28px] font-bold leading-tight">Sais toujours<br />où tu es.</h1>
              <p className="mt-2 text-[14px] text-[#5B6785]">L'app suit ta position et t'alerte avant ton arrêt. Aider la communauté en partageant ta position est optionnel, anonyme et désactivable à tout moment, après un consentement séparé.</p>
            </div>
            <div className="rounded-[20px] border border-[#E3E8F3] bg-white p-4">
              <SectionTitleInline t="Ton trajet en temps réel" />
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 py-1.5">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full ${i === 0 ? 'bg-[#E8F5EE] text-[#12A150]' : i === 1 ? 'bg-[#E8EFFF] text-[#1F5EFF]' : 'bg-[#FFF3E0] text-[#F5A623]'}`}>•</span>
                  <span><span className="block font-semibold">Nom de l'arrêt</span><span className="text-[14px] text-[#5B6785]">Point de montée</span></span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 rounded-[16px] border border-[#F5A62340] bg-[#FFF8ED] p-4">
              <span className="text-2xl">💬</span>
              <span><span className="block text-[13px] font-semibold">Astuce de voyage</span><span className="text-[12px] text-[#5B6785]">Un doute ? Demande toujours au receveur — il connaît chaque arrêt par cœur.</span></span>
            </div>
          </div>
          <div className="space-y-2 bg-[#F6F8FB] px-6 pb-2 pt-3">
            <PrimaryButton onClick={goHome}>C'est parti !</PrimaryButton>
            <button onClick={() => setStep(1)} className="flex h-14 w-full items-center justify-center rounded-full border border-[#1F5EFF] font-semibold text-[#0B3BCC]">← Précédent</button>
          </div>
        </>
      )}
      <BottomNav active="accueil" />
    </Phone>
  )
}

function SectionTitleInline({ t }: { t: string }) {
  return <p className="pb-1 text-[12px] font-semibold uppercase tracking-wide text-[#5B6785]">{t}</p>
}

// re-export to avoid unused
export const _x = SchematicMap
