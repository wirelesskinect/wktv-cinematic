import Image from 'next/image'

interface LogoProps {
  className?: string
  showText?: boolean
}

export function Logo({ className = 'w-10 h-10', showText = false }: LogoProps) {
  return (
    <div className="flex items-center gap-3">
      <Image
        src="/wktv-logo.jpg"
        alt="WKTV"
        width={40}
        height={40}
        className={`${className} object-contain`}
      />
      {showText && (
        <div className="flex flex-col">
          <span className="text-xl font-bold tracking-tight leading-none">
            <span className="text-red-600">W</span>
            <span className="text-gray-400">K</span>
            <span className="text-white">TV</span>
          </span>
          <span className="text-[10px] text-gray-500 uppercase tracking-widest">Watch Anywhere</span>
        </div>
      )}
    </div>
  )
}

// Text-only logo for smaller spaces
export function LogoText({ className = '' }: { className?: string }) {
  return (
    <span className={`font-bold tracking-tight ${className}`}>
      <span className="text-red-600">W</span>
      <span className="text-gray-400">K</span>
      <span className="text-white">TV</span>
    </span>
  )
}
