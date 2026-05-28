# Phase 1 – Dashboard: Shopping interactivo + Calendario

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir navegación al dashboard, una vista de lista de la compra con checkboxes interactivos (Server Actions) y una vista de calendario con los próximos eventos.

**Prerequisite:** Phase 0 dashboard completo. Phase 1 agent completo (tablas calendar_events y event_reminders activas).

---

### Task 1: Layout con navegación

**Files:**
- Update: `dashboard/src/app/dashboard/layout.tsx` (crear)

- [ ] **Step 1: Crear layout con nav**

```tsx
// dashboard/src/app/dashboard/layout.tsx
import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <nav className="border-b px-8 py-4 flex gap-6 text-sm font-medium">
        <Link href="/dashboard"           className="hover:underline">Inicio</Link>
        <Link href="/dashboard/shopping"  className="hover:underline">Lista de la compra</Link>
        <Link href="/dashboard/calendar"  className="hover:underline">Agenda</Link>
      </nav>
      <div>{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd dashboard && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/dashboard/layout.tsx
git commit -m "feat: dashboard navigation layout"
```

---

### Task 2: Shopping interactivo con Server Actions

**Files:**
- Create: `dashboard/src/app/dashboard/shopping/page.tsx`
- Create: `dashboard/src/app/dashboard/shopping/actions.ts`

- [ ] **Step 1: Crear Server Action para marcar items**

```typescript
// dashboard/src/app/dashboard/shopping/actions.ts
'use server';

import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function toggleItem(id: string, checked: boolean) {
  const admin = createSupabaseAdminClient();
  await admin
    .from('shopping_items')
    .update({ checked })
    .eq('id', id);
  revalidatePath('/dashboard/shopping');
}

export async function clearChecked() {
  const admin = createSupabaseAdminClient();
  await admin
    .from('shopping_items')
    .delete()
    .eq('family_id', process.env.FAMILY_ID ?? '')
    .eq('checked', true);
  revalidatePath('/dashboard/shopping');
}
```

- [ ] **Step 2: Crear página de shopping**

```tsx
// dashboard/src/app/dashboard/shopping/page.tsx
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
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

  const pending  = items?.filter(i => !i.checked) ?? [];
  const checked  = items?.filter(i =>  i.checked) ?? [];

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Lista de la compra</h1>
        {checked.length > 0 && (
          <form action={clearChecked}>
            <button
              type="submit"
              className="text-sm text-gray-500 hover:text-red-500 underline"
            >
              Limpiar comprados ({checked.length})
            </button>
          </form>
        )}
      </div>

      {pending.length === 0 && checked.length === 0 && (
        <p className="text-gray-400">Lista vacía. Pídele a JARVIS que añada algo.</p>
      )}

      <ul className="space-y-2">
        {pending.map(item => (
          <li key={item.id} className="flex items-center gap-3 border rounded px-4 py-3">
            <form action={toggleItem.bind(null, item.id, true)}>
              <button type="submit" className="w-5 h-5 rounded border border-gray-300 hover:border-black flex-shrink-0" />
            </form>
            <span className="flex-1">{item.name}</span>
            {item.quantity && <span className="text-gray-400 text-sm">{item.quantity}</span>}
          </li>
        ))}

        {checked.map(item => (
          <li key={item.id} className="flex items-center gap-3 border rounded px-4 py-3 opacity-50">
            <form action={toggleItem.bind(null, item.id, false)}>
              <button type="submit" className="w-5 h-5 rounded border border-gray-400 bg-gray-400 flex-shrink-0" />
            </form>
            <span className="flex-1 line-through">{item.name}</span>
            {item.quantity && <span className="text-gray-400 text-sm">{item.quantity}</span>}
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 3: Run typecheck**

```bash
cd dashboard && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Verificación manual**

1. Ir a `http://localhost:3000/dashboard/shopping`
2. Los items aparecen en la lista
3. Pulsar el checkbox de un item → se tacha
4. Pulsar "Limpiar comprados" → los items tachados desaparecen

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/app/dashboard/shopping/
git commit -m "feat: shopping interactivo con Server Actions"
```

---

### Task 3: Vista de agenda (calendario)

**Files:**
- Create: `dashboard/src/app/dashboard/calendar/page.tsx`

- [ ] **Step 1: Crear página de calendario**

```tsx
// dashboard/src/app/dashboard/calendar/page.tsx
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function CalendarPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createSupabaseAdminClient();
  const now   = new Date().toISOString();
  const month = new Date(Date.now() + 30 * 86400_000).toISOString();

  const { data: events } = await admin
    .from('calendar_events')
    .select('id, title, start_time, end_time, all_day, description')
    .eq('family_id', process.env.FAMILY_ID ?? '')
    .gte('start_time', now)
    .lte('start_time', month)
    .order('start_time', { ascending: true })
    .limit(20);

  const tz     = 'Europe/Madrid';
  const locale = 'es-ES';

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Agenda — próximos 30 días</h1>

      {!events?.length ? (
        <p className="text-gray-400">Sin eventos próximos. Dile a JARVIS que añada uno.</p>
      ) : (
        <ul className="space-y-3">
          {events.map(event => {
            const date = new Date(event.start_time);
            const dateStr = event.all_day
              ? date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz })
              : date.toLocaleString(locale, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: tz });

            return (
              <li key={event.id} className="border rounded px-4 py-3">
                <p className="font-medium">{event.title}</p>
                <p className="text-sm text-gray-500 mt-1">{dateStr}</p>
                {event.description && (
                  <p className="text-sm text-gray-400 mt-1">{event.description}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd dashboard && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Verificación manual**

1. Ir a `http://localhost:3000/dashboard/calendar`
2. Aparecen los eventos añadidos por JARVIS en el smoke test del agent
3. Las fechas se muestran en español con zona horaria Europe/Madrid

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/app/dashboard/calendar/
git commit -m "feat: calendario — próximos 30 días"
```

---

### Task 4: Actualizar página principal del dashboard

**Files:**
- Update: `dashboard/src/app/dashboard/page.tsx`

- [ ] **Step 1: Añadir enlace a la shopping y al calendario desde el panel principal**

```tsx
// dashboard/src/app/dashboard/page.tsx
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createSupabaseAdminClient();

  const [{ data: items }, { data: events }] = await Promise.all([
    admin
      .from('shopping_items')
      .select('id, name, quantity')
      .eq('family_id', process.env.FAMILY_ID ?? '')
      .eq('checked', false)
      .order('created_at', { ascending: false })
      .limit(5),
    admin
      .from('calendar_events')
      .select('id, title, start_time')
      .eq('family_id', process.env.FAMILY_ID ?? '')
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(3),
  ]);

  return (
    <main className="p-8 max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-semibold">JARVIS — Panel familiar</h1>

      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-medium">Lista de la compra</h2>
          <Link href="/dashboard/shopping" className="text-sm text-gray-500 hover:underline">Ver todo →</Link>
        </div>
        {!items?.length ? (
          <p className="text-gray-400 text-sm">Lista vacía.</p>
        ) : (
          <ul className="space-y-1">
            {items.map(item => (
              <li key={item.id} className="flex gap-2 border rounded px-3 py-2 text-sm">
                <span className="flex-1">{item.name}</span>
                {item.quantity && <span className="text-gray-400">{item.quantity}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-medium">Próximos eventos</h2>
          <Link href="/dashboard/calendar" className="text-sm text-gray-500 hover:underline">Ver todo →</Link>
        </div>
        {!events?.length ? (
          <p className="text-gray-400 text-sm">Sin eventos próximos.</p>
        ) : (
          <ul className="space-y-1">
            {events.map(event => (
              <li key={event.id} className="border rounded px-3 py-2 text-sm">
                <span className="font-medium">{event.title}</span>
                <span className="text-gray-400 ml-2">
                  {new Date(event.start_time).toLocaleDateString('es-ES', {
                    day: 'numeric', month: 'short', timeZone: 'Europe/Madrid',
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd dashboard && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/dashboard/page.tsx
git commit -m "feat: dashboard home con resumen shopping + próximos eventos"
```

---

### Task 5: Smoke test dashboard Phase 1

- [ ] **Step 1: Verificar shopping interactivo**

1. JARVIS añade "tomate, aceite, sal" desde Telegram
2. Abrir `http://localhost:3000/dashboard/shopping`
3. Marcar "tomate" → se tacha ✓
4. Pulsar "Limpiar comprados" → tomate desaparece ✓

- [ ] **Step 2: Verificar calendario**

1. JARVIS añade "examen Sofía el 21 de junio a las 10"
2. Abrir `http://localhost:3000/dashboard/calendar`
3. El evento aparece con fecha en español ✓

- [ ] **Step 3: Verificar panel principal**

1. Abrir `http://localhost:3000/dashboard`
2. Muestra últimos 5 items pendientes ✓
3. Muestra próximos 3 eventos ✓
4. Los links "Ver todo →" navegan correctamente ✓

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: Phase 1 dashboard complete — shopping interactivo + agenda"
```
