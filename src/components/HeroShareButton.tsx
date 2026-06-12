'use client'

interface Props {
  productName: string
  bestPrice: number
  pvp: number
  nextPrice: number
  groupId: string
}

function wa(n: number) { return n.toFixed(2).replace('.', ',') }

export default function HeroShareButton({ productName, bestPrice, pvp, nextPrice, groupId }: Props) {
  function handleShare() {
    const url = `${window.location.origin}/grupo/${groupId}`
    const text = `🚴 ${productName} a ${wa(bestPrice)}€ (PVP ${wa(pvp)}€). Si entra 1 más baja a ${wa(nextPrice)}€. Cierra el domingo 22:00: ${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <button
      onClick={handleShare}
      className="w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
      aria-label="Compartir por WhatsApp"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="text-[#25D366]">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        <path d="M12 0C5.374 0 0 5.373 0 12c0 2.117.555 4.103 1.523 5.826L.057 23.985a.5.5 0 0 0 .558.642l6.46-1.695A11.956 11.956 0 0 0 12 24c6.626 0 12-5.373 12-12S18.626 0 12 0zm0 21.818a9.806 9.806 0 0 1-5.064-1.41l-.364-.214-3.755.985.997-3.648-.235-.374A9.817 9.817 0 0 1 2.182 12c0-5.424 4.394-9.818 9.818-9.818s9.818 4.394 9.818 9.818-4.394 9.818-9.818 9.818z"/>
      </svg>
    </button>
  )
}
