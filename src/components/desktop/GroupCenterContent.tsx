'use client'

interface Props {
  name: string
  imageUrl?: string | null
}

export default function GroupCenterContent({ name, imageUrl }: Props) {
  return (
    <div className="rounded-2xl bg-[#E7F2F2] border border-neutral-200/60 overflow-hidden aspect-[4/3] flex items-center justify-center">
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <div className="flex flex-col items-center gap-2 text-neutral-400">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
          </svg>
          <span className="text-sm text-neutral-500">{name} · foto principal</span>
        </div>
      )}
    </div>
  )
}
