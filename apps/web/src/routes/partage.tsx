import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Phone, PrimaryButton } from '@/components/yoonu'
import { copyText } from '@/lib/monstarx/clipboard'

export const Route = createFileRoute('/partage')({
  component: Partage,
})
function Partage() {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)
  const handleCopy = async () => {
    try {
      await copyText(text)
      setCopied(true)
      setCopyError(null)
    } catch {
      setCopied(false)
      setCopyError('Copie impossible dans ce navigateur. Sélectionne le texte ci-dessous pour le copier à la main.')
    }
  }
  const text = 'Je prends le Tata 24 direction Université. Je descends à « Université » puis 3 min à pied vers ISM Dakar. Suis-moi avec Yoonu Bus !'
  return (
    <Phone>
      <div className="flex items-center gap-3 px-5 pt-2"><Link to="/suivi" search={{ from: 'Castor', to: 'ISM Dakar', etat: 'encours' } as never}>←</Link><h1 className="text-[17px] font-bold">Partage · ton choix</h1></div>
      <div className="px-5 pt-4">
        <div className="rounded-[20px] border border-[#E3E8F3] bg-white p-4">
          <p className="text-[13px] text-[#5B6785]">Ton message</p>
          <p className="mt-1 font-medium">{text}</p>
        </div>
        <div className="mt-3"><PrimaryButton onClick={handleCopy}>{copied ? '✓ Copié !' : 'Copier le message'}</PrimaryButton></div>
        {copyError && (
          <div role="alert" className="mt-2 rounded-2xl border border-[#F5C518] bg-[#FFFBEA] p-3">
            <p className="text-[14px] font-medium text-[#0F1B3D]">{copyError}</p>
            <textarea readOnly value={text} rows={3} onFocus={(e) => e.currentTarget.select()} aria-label="Message à copier manuellement" className="mt-2 w-full rounded-xl border border-[#E3E8F3] bg-white p-2 text-[14px] text-[#0F1B3D]" />
          </div>
        )}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} className="flex h-12 items-center justify-center rounded-full border border-[#E3E8F3] bg-white font-semibold text-[#0F1B3D]">WhatsApp</a>
          <a href={`sms:?body=${encodeURIComponent(text)}`} className="flex h-12 items-center justify-center rounded-full border border-[#E3E8F3] bg-white font-semibold text-[#0F1B3D]">SMS</a>
        </div>
      </div>
    </Phone>
  )
}
