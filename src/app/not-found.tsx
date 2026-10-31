import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="portal-narrow text-center animate-in">
      <div className="card">
        <span className="eyebrow">Page not found</span>
        <h1 className="page-title">This channel isn&apos;t available</h1>
        <p className="page-sub mb-6">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
        <div className="flex flex-col gap-3">
          <a href="/" className="btn-primary w-full">Back to home</a>
          <Link href="/dashboard" className="btn-secondary w-full">My account</Link>
        </div>
      </div>
    </div>
  )
}
