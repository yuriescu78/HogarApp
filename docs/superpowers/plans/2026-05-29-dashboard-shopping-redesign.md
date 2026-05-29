# Dashboard Shopping Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar el diseño dark mode iOS-style aprobado a `/dashboard/shopping` y `/login`, sin tocar la lógica de Server Actions existente.

**Architecture:** Solo cambios visuales en Server/Client Components existentes. Sin nueva lógica. La lógica de `toggleItem` y `clearChecked` en `actions.ts` no se toca. Los tokens de color se centralizan en `globals.css`.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, CSS variables, `style` inline para gradientes.

**Spec de referencia:** `docs/superpowers/specs/2026-05-29-dashboard-shopping-design.md`  
**Mockup aprobado:** `dashboard/mockups/opt-final.html`

---

## Archivos modificados

| Archivo | Acción | Qué cambia |
|---|---|---|
| `dashboard/src/app/globals.css` | Modificar | Tokens CSS dark mode + body background forzado |
| `dashboard/src/app/layout.tsx` | Modificar | `lang="es"`, título JARVIS, clase dark en body |
| `dashboard/src/app/dashboard/layout.tsx` | Modificar | Nav dark mode |
| `dashboard/src/app/dashboard/shopping/page.tsx` | Reescribir | UI completa dark iOS-style |
| `dashboard/src/app/login/page.tsx` | Reescribir | UI dark con gradiente morado |

`actions.ts` **no se toca** — la lógica está correcta.

---

### Task 1: Tokens CSS y base dark mode

**Files:**
- Modify: `dashboard/src/app/globals.css`
- Modify: `dashboard/src/app/layout.tsx`

- [ ] **Step 1: Reemplazar globals.css con tokens dark y body forzado**

```css
/* dashboard/src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg-base:      #0f0f11;
  --bg-surface:   #1a1a22;
  --bg-elevated:  #24242e;
  --border:       #24242e;
  --border-sub:   #2a2a32;
  --text-primary: #f0f0f0;
  --text-secondary: #636366;
  --text-tertiary:  #48484a;
  --green:   #30d158;
  --red:     #ff453a;
  --purple:  #6e40c9;
  --magenta: #c940a0;
}

body {
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: -apple-system, "SF Pro Text", BlinkMacSystemFont, sans-serif;
}

@layer utilities {
  .text-balance { text-wrap: balance; }
}
```

- [ ] **Step 2: Actualizar layout.tsx raíz**

```tsx
// dashboard/src/app/layout.tsx
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'JARVIS — Familia García',
  description: 'Mayordomo digital familiar',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
cd dashboard && npm run typecheck
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/app/globals.css dashboard/src/app/layout.tsx
git commit -m "style: dark mode tokens + root layout JARVIS"
```

---

### Task 2: Nav dark mode

**Files:**
- Modify: `dashboard/src/app/dashboard/layout.tsx`

- [ ] **Step 1: Reemplazar layout con nav dark**

```tsx
// dashboard/src/app/dashboard/layout.tsx
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
```

- [ ] **Step 2: Typecheck**

```bash
cd dashboard && npm run typecheck
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/dashboard/layout.tsx
git commit -m "style: dashboard nav dark mode"
```

---

### Task 3: Shopping page — rediseño completo

**Files:**
- Modify: `dashboard/src/app/dashboard/shopping/page.tsx`

Esta es la pieza central. Se mantiene la misma estructura de Server Component + Server Actions. Solo cambia el JSX y los estilos.

- [ ] **Step 1: Reemplazar page.tsx con UI dark iOS-style**

```tsx
// dashboard/src/app/dashboard/shopping/page.tsx
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { toggleItem, clearChecked } from './actions';

export default async function ShoppingPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createSupabaseAdminClient();
  const { data: items } = await admin
    .from('shopping_items')
    .select('id, name, quantity, checked')
    .eq('family_id', process.env.FAMILY_ID ?? '')
    .order('checked', { ascending: true })
    .order('created_at', { ascending: true });

  const pending = items?.filter(i => !i.checked) ?? [];
  const done    = items?.filter(i =>  i.checked) ?? [];

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>
      {/* Header sticky iOS-style */}
      <header
        className="sticky top-0 px-5 pb-4 pt-10"
        style={{
          background: 'rgba(15,15,17,0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '0.5px solid var(--border)',
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6e40c9, #c940a0)' }}
          >
            G
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Familia García
          </span>
        </div>

        <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          La compra
        </h1>

        <div className="flex gap-2 mt-1.5">
          {pending.length > 0 && (
            <span
              className="text-xs font-bold px-2.5 py-0.5 rounded-full text-white"
              style={{ background: 'var(--red)' }}
            >
              {pending.length} pendientes
            </span>
          )}
          {done.length > 0 && (
            <span
              className="text-xs font-bold px-2.5 py-0.5 rounded-full text-white"
              style={{ background: 'var(--green)' }}
            >
              {done.length} comprados
            </span>
          )}
        </div>
      </header>

      {/* Contenido */}
      <div className="px-4 py-5 space-y-6">

        {/* Lista vacía */}
        {pending.length === 0 && done.length === 0 && (
          <p className="text-center py-12 text-sm" style={{ color: 'var(--text-tertiary)' }}>
            Lista vacía. Dile a JARVIS por Telegram qué añadir.
          </p>
        )}

        {/* Pendientes */}
        {pending.length > 0 && (
          <section>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2 px-1"
               style={{ color: 'var(--text-tertiary)' }}>
              Pendientes
            </p>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              {pending.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3.5 px-4 py-3.5"
                  style={idx > 0 ? { borderTop: '0.5px solid var(--border)' } : undefined}
                >
                  <form action={toggleItem.bind(null, item.id, true)}>
                    <button
                      type="submit"
                      className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center"
                      style={{ border: '2px solid #3a3a3c', background: 'transparent' }}
                      aria-label={`Marcar ${item.name} como comprado`}
                    />
                  </form>
                  <div className="flex-1 min-w-0">
                    <p className="text-base" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
                    {item.quantity && (
                      <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {item.quantity}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Comprados */}
        {done.length > 0 && (
          <section>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2 px-1"
               style={{ color: 'var(--text-tertiary)' }}>
              Ya en el carrito
            </p>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              {done.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3.5 px-4 py-3.5 opacity-40"
                  style={idx > 0 ? { borderTop: '0.5px solid var(--border)' } : undefined}
                >
                  <form action={toggleItem.bind(null, item.id, false)}>
                    <button
                      type="submit"
                      className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center"
                      style={{ background: 'var(--green)', border: '2px solid var(--green)' }}
                      aria-label={`Desmarcar ${item.name}`}
                    >
                      {/* checkmark SVG inline */}
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </form>
                  <div className="flex-1 min-w-0">
                    <p className="text-base line-through" style={{ color: 'var(--text-secondary)' }}>
                      {item.name}
                    </p>
                    {item.quantity && (
                      <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        {item.quantity}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Botón limpiar */}
            <form action={clearChecked} className="mt-2">
              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl text-sm font-medium transition-opacity hover:opacity-80"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--red)',
                }}
              >
                🗑 Limpiar {done.length} comprados
              </button>
            </form>
          </section>
        )}

        {/* Banner JARVIS */}
        <div
          className="rounded-2xl p-4 flex items-center gap-3"
          style={{
            background: 'linear-gradient(135deg, #2d1f6e, #4a1a5e)',
            border: '1px solid #3d2a7a',
          }}
        >
          <span className="text-2xl flex-shrink-0">🎩</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#c4a8ff' }}>
              JARVIS al habla
            </p>
            <p className="text-xs leading-relaxed mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Dígame por Telegram qué añadir y lo tendré listo al instante.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd dashboard && npm run typecheck
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/dashboard/shopping/page.tsx
git commit -m "style: shopping page dark mode iOS redesign"
```

---

### Task 4: Login page dark mode

**Files:**
- Modify: `dashboard/src/app/login/page.tsx`

La lógica de OTP no cambia. Solo el JSX/estilos.

- [ ] **Step 1: Reemplazar page.tsx con UI dark**

```tsx
// dashboard/src/app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email,   setEmail]   = useState('');
  const [token,   setToken]   = useState('');
  const [step,    setStep]    = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const supabase = createSupabaseBrowserClient();
  const router   = useRouter();

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOtp({ email });
    setLoading(false);
    if (error) setError(error.message);
    else setStep('otp');
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    setLoading(false);
    if (error) setError(error.message);
    else router.push('/dashboard');
  }

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: 'var(--bg-base)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  };

  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '320px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    fontSize: '15px',
    outline: 'none',
  };

  const btnPrimaryStyle: React.CSSProperties = {
    width: '100%',
    padding: '13px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #6e40c9, #c940a0)',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    opacity: loading ? 0.6 : 1,
  };

  if (step === 'otp') {
    return (
      <main style={containerStyle}>
        <form onSubmit={handleVerifyOtp} style={cardStyle}>
          <div className="text-center mb-2">
            <span style={{ fontSize: 36 }}>🎩</span>
            <h1 className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
              JARVIS
            </h1>
          </div>

          <p className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
            Introduce el código enviado a<br />
            <span style={{ color: 'var(--text-primary)' }}>{email}</span>
          </p>

          <input
            type="text"
            inputMode="numeric"
            placeholder="123456"
            value={token}
            onChange={e => setToken(e.target.value)}
            required
            maxLength={6}
            autoFocus
            style={{ ...inputStyle, textAlign: 'center', fontSize: '24px', letterSpacing: '0.3em' }}
          />

          {error && (
            <p className="text-sm text-center" style={{ color: 'var(--red)' }}>{error}</p>
          )}

          <button type="submit" disabled={loading} style={btnPrimaryStyle}>
            {loading ? 'Verificando…' : 'Entrar'}
          </button>

          <button
            type="button"
            onClick={() => setStep('email')}
            className="text-sm text-center"
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            Volver
          </button>
        </form>
      </main>
    );
  }

  return (
    <main style={containerStyle}>
      <form onSubmit={handleSendOtp} style={cardStyle}>
        <div className="text-center mb-2">
          <span style={{ fontSize: 36 }}>🎩</span>
          <h1 className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
            JARVIS
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Mayordomo digital de la familia García
          </p>
        </div>

        <input
          type="email"
          placeholder="tu@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          style={inputStyle}
        />

        {error && (
          <p className="text-sm text-center" style={{ color: 'var(--red)' }}>{error}</p>
        )}

        <button type="submit" disabled={loading} style={btnPrimaryStyle}>
          {loading ? 'Enviando…' : 'Enviar código'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd dashboard && npm run typecheck
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/login/page.tsx
git commit -m "style: login page dark mode con gradiente JARVIS"
```

---

### Task 5: Smoke test visual en el navegador

- [ ] **Step 1: Arrancar el dashboard**

```bash
cd dashboard && npm run dev
```

Abrir `http://localhost:3000`.

- [ ] **Step 2: Verificar login**

1. Ir a `http://localhost:3000/login`
2. Fondo negro ✓, logo 🎩 centrado ✓, input oscuro ✓, botón degradado morado-magenta ✓

- [ ] **Step 3: Verificar shopping**

1. Hacer login con magic link o ir directamente a `http://localhost:3000/dashboard/shopping`
2. Header sticky con "Familia García" + badges ✓
3. Lista agrupada en tarjeta oscura ✓
4. Checkbox circular vacío en gris ✓
5. Ítems comprados con ✓ verde y opacidad 40% ✓
6. Botón "Limpiar" en rojo ✓
7. Banner JARVIS degradado morado al pie ✓

- [ ] **Step 4: Verificar interacciones**

1. Pulsar un checkbox → el ítem pasa a "Ya en el carrito" (Server Action + revalidatePath)
2. Pulsar "Limpiar N comprados" → los ítems desaparecen

- [ ] **Step 5: Typecheck final**

```bash
cd dashboard && npm run typecheck
```

Expected: sin errores.
