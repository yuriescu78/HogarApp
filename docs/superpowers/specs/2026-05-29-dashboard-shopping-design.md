# Dashboard Shopping — Design Spec

**Date:** 2026-05-29  
**Scope:** Rediseño visual de `/dashboard/shopping` (Phase 0). Solo la vista de lista de la compra.  
**Status:** Aprobado

---

## Decisión de diseño

Se adopta un híbrido entre Opción 2 (estructura iOS) y Opción 3 (paleta dark):

- **Layout:** iOS-style con header grande, badges de estado, lista agrupada en tarjeta única, y banner JARVIS al pie.
- **Paleta:** Dark mode. Fondo base `#0f0f11`, superficie `#1a1a22`, bordes `#24242e`.
- **Checkboxes:** Circulares. Vacíos: borde `#3a3a3c`. Comprados: relleno verde `#30d158` con tick blanco.
- **Acciones destructivas:** Rojo `#ff453a` (botón Limpiar).
- **Acento identidad:** Degradado morado-magenta (`#6e40c9 → #c940a0`) para el avatar y el banner JARVIS.

El mockup aprobado está en `dashboard/mockups/opt-final.html`.

---

## Alcance

**Incluye:**
- Página `/dashboard/shopping` — lista de la compra con checkboxes interactivos
- Página `/login` — magic link con el mismo lenguaje visual dark
- Layout `dashboard/layout.tsx` — solo navegación mínima (sin sidebar, sin bottom nav)

**No incluye (fuera de Phase 0):**
- Calendario, notas, recetas, tareas, mascotas
- Añadir ítems desde el dashboard (solo desde Telegram/JARVIS)
- Búsqueda o filtros

---

## Tokens de diseño

```css
/* Fondos */
--bg-base:     #0f0f11;
--bg-surface:  #1a1a22;
--bg-elevated: #24242e;

/* Bordes */
--border:      #24242e;
--border-sub:  #2a2a32;

/* Texto */
--text-primary:   #f0f0f0;
--text-secondary: #636366;
--text-tertiary:  #48484a;

/* Semánticos */
--green:   #30d158;   /* comprado / éxito */
--red:     #ff453a;   /* limpiar / destructivo */
--purple:  #6e40c9;   /* acento JARVIS */
--magenta: #c940a0;   /* acento JARVIS (gradiente) */

/* Badge textos */
--badge-pending-bg: #ff453a;
--badge-done-bg:    #30d158;
```

---

## Componentes

### Header (sticky)
- Fondo `#0f0f11` con `backdrop-filter: blur(20px)`
- Fila superior: avatar circular con inicial + "Familia García" en `--text-secondary`
- Título H1 28px bold: "La compra"
- Badges: "N pendientes" (rojo) + "N comprados" (verde)
- Separador inferior `0.5px solid --border`

### Lista de ítems
- Contenedor: `background: --bg-surface`, `border-radius: 14px`, `border: 1px solid --border`
- Separadores internos: `0.5px` desde `left: 54px` (después del checkbox)
- Ítem pendiente: texto `--text-primary`, cantidad `--text-secondary`
- Ítem comprado: opacidad `0.4`, nombre tachado

### Checkbox circular
- Pendiente: `24px`, borde `2px solid #3a3a3c`
- Comprado: relleno `#30d158`, tick blanco `2px` rotado

### Botón "Limpiar comprados"
- Full width, `background: --bg-surface`, borde `--border`, `border-radius: 14px`
- Color texto: `--red`
- Solo visible cuando hay ítems comprados

### Banner JARVIS
- `background: linear-gradient(135deg, #2d1f6e, #4a1a5e)`
- Borde `#3d2a7a`, `border-radius: 14px`
- Icono sombrero de copa 26px + texto "JARVIS al habla" en `#c4a8ff` + descripción

---

## Página de login (magic link)

Misma paleta dark. Centrado vertical. Elementos:
- Logo JARVIS (icono 🎩 + nombre) en la parte superior
- Input email + botón "Enviar enlace" (fondo gradiente morado-magenta, texto blanco)
- Estado post-envío: "Revisa tu correo" con icono ✉️

No necesita nav ni header.

---

## Implementación

El diseño se aplica **solo** a:
- `dashboard/src/app/dashboard/shopping/page.tsx`
- `dashboard/src/app/login/page.tsx`
- `dashboard/src/app/globals.css` (tokens CSS)

El resto del dashboard (calendar, home) mantiene su estilo actual hasta que se diseñe en fases posteriores.

Las páginas son **Server Components** con Server Actions para toggle y clear. El estilo se implementa con clases Tailwind para spacing, layout y colores estándar. Los gradientes (`linear-gradient`) y `backdrop-filter` van como `style` inline porque Tailwind no los soporta de forma arbitraria sin configuración adicional.
