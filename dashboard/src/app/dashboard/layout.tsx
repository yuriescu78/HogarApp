import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <nav className="border-b px-8 py-4 flex gap-6 text-sm font-medium">
        <Link href="/dashboard"          className="hover:underline">Inicio</Link>
        <Link href="/dashboard/shopping" className="hover:underline">Lista de la compra</Link>
        <Link href="/dashboard/calendar" className="hover:underline">Agenda</Link>
      </nav>
      <div>{children}</div>
    </div>
  );
}
