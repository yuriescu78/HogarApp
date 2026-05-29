import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <nav
        className="flex gap-6 px-5 py-3 text-sm font-medium"
        style={{ borderBottom: '0.5px solid var(--border)', color: 'var(--text-secondary)' }}
      >
        <Link href="/dashboard"          className="hover:text-white transition-colors">Inicio</Link>
        <Link href="/dashboard/shopping" className="hover:text-white transition-colors">La compra</Link>
        <Link href="/dashboard/calendar" className="hover:text-white transition-colors">Agenda</Link>
      </nav>
      <div>{children}</div>
    </div>
  );
}
