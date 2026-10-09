# 02 — Diseño y UI

Fuente: CSS de producción de https://www.pasoluciones.com.ar (`:root`) y logos en `spec/assets/`.

## 1. Design tokens

```css
:root {
  /* Marca (idénticos a la web) */
  --primary:      #f49600;  /* naranja PAS */
  --secondary:    #5f5e5e;  /* gris del logo */
  --bg-light:     #f2f4f6;
  --bg-dark:      #1f2123;
  --text-dark:    #1a1a1a;
  --text-light:   #f9f9f9;
  --text-muted:   #848484;
  --border:       #e1e1e1;
  --success:      #22c55e;

  /* Derivados para la app (nuevos) */
  --primary-hover:  #ffa41a;           /* brightness(1.1) de la web */
  --primary-soft:   #f496001a;          /* fondos de selección / badges */
  --primary-text:   #9a5e00;            /* naranja oscuro para TEXTO sobre blanco (≈5,3:1, AA) */
  --danger:         #dc2626;
  --warning:        #d97706;
  --info:           #2563eb;
  --surface:        #ffffff;

  --font-heading: "Poppins", sans-serif;   /* 600 / 700 / 800 */
  --font-body:    "Outfit", sans-serif;    /* 300 / 400 / 600 */
  --radius:       12px;
  --radius-sm:    8px;
  --transition:   all .3s cubic-bezier(.4, 0, .2, 1);
  --shadow-cta:   0 4px 14px #f496004d;
}
```

### Modo oscuro
Basado en las secciones oscuras de la web: fondo `--bg-dark`, superficies `#2a2d30`, texto `--text-light`, bordes `#3a3d40`. El naranja se mantiene. Toggle en el perfil: claro / oscuro / sistema.

### Reglas de accesibilidad de color (importante)
- `#f49600` sobre blanco tiene contraste ≈ 2,3:1 → **no usar naranja para texto sobre fondo claro.** Para texto/links usar `--primary-text`.
- Botón primario: fondo `--primary` con texto `--bg-dark` (contraste ≈ 7:1), igual que `.btn-cta` de la web.
- Los estados nunca se comunican solo con color: siempre badge con texto + ícono.

## 2. Tipografía

| Uso | Fuente | Peso | Tamaño (mobile / desktop) |
|---|---|---|---|
| H1 página | Poppins | 700 | 22 / 28 px |
| H2 sección | Poppins | 600 | 18 / 20 px |
| Botones | Poppins, UPPERCASE | 700 | 14 px |
| Cuerpo | Outfit | 400 | 16 / 15 px |
| Secundario / metadata | Outfit | 300–400, `--text-muted` | 13 px |
| Montos e IDs | Outfit, `font-variant-numeric: tabular-nums` | 600 | — |

Fuentes servidas con `next/font/google` (self-hosted, sin request externo).

## 3. Componentes clave (estilo)

- **Botón primario:** como `.btn-cta` de la web: naranja, texto oscuro, uppercase, radius 12px, sombra naranja, hover `translateY(-2px)` + brillo.
- **Botón secundario:** borde `--border`, fondo transparente.
- **Botón destructivo:** `--danger`, siempre con diálogo de confirmación.
- **Badge de estado** (presupuesto):

| Estado | Color |
|---|---|
| Prospecto | gris (`--secondary`) |
| Visita técnica | azul (`--info`) |
| En espera | ámbar (`--warning`) |
| En progreso | naranja (`--primary`) |
| Pendiente liquidación | violeta `#7c3aed` |
| Terminado | verde (`--success`) |
| Rechazado | rojo apagado `#9f1239` |
| Cancelado | gris tachado |
| Bonificado (marca) | chip naranja suave con ícono `%` |

- **ID de presupuesto:** siempre en monoespaciado tabular, con botón "copiar".
- **Cards:** superficie blanca, radius 12px, borde `--border`, sin sombras pesadas.

## 4. Layout

### Desktop (≥ 1024 px)
- **Sidebar** izquierda oscura (`--bg-dark`) con logo alt (`assets/logo-alt.svg`), navegación e indicador naranja en el ítem activo.
- **Topbar:** buscador global (atajo `Ctrl/⌘ + K`), botón "+ Nuevo" (prospecto, gasto, compra), campana de notificaciones, avatar.
- Contenido con breadcrumbs: `Clientes / Constructora Ejemplo / Av. Córdoba 1234 / 2026/0105`.
- Explorador en dos paneles: árbol de carpetas a la izquierda y contenido a la derecha.

### Mobile (< 768 px)
- **Bottom navigation** de 5 ítems: Inicio · Explorador · Agenda · Campo · Más.
- Botón flotante "+" contextual (en un presupuesto: "Registrar perforación", "Cargar gasto", "Subir foto").
- Explorador como lista navegable (una carpeta por pantalla) con breadcrumb compacto.
- Tablas → listas de cards. Formularios en una columna, inputs ≥ 44 px de alto, `inputmode` correcto (numérico para cantidades y montos).
- La cámara se abre directo desde "Subir foto" (`<input type="file" accept="image/*" capture="environment">`).
- Indicador visible de "Sin conexión · N cambios pendientes de sincronizar".

### Tablet (768–1023 px)
Sidebar colapsable (solo íconos) y contenido a ancho completo.

## 5. Mapa de pantallas

| Pantalla | Desktop | Mobile |
|---|---|---|
| **Inicio (dashboard)** | KPIs: presupuestos por estado, en espera > 7 días, cobros pendientes, visitas de la semana, stock bajo | Mismas tarjetas apiladas + "Mis trabajos de hoy" primero |
| **Explorador** | Árbol Clientes → Obras → Presupuestos → Documentos | Navegación por niveles |
| **Tablero de seguimiento** | Kanban por estado (drag & drop valida transiciones) + vista lista | Lista filtrable por estado (chips) |
| **Presupuesto (detalle)** | Tabs: Resumen · Ítems · Documentos · Campo · Stock y gastos · Cobros · Anexos · Historial | Mismas tabs con scroll horizontal |
| **Editor de documento** | Formulario a la izquierda, vista previa a la derecha; acciones IA por bloque | Formulario y vista previa en tabs |
| **Agenda** | Calendario mes/semana | Lista por día |
| **Campo** | — | Mis presupuestos en progreso → registrar perforación/gasto/consumo (funciona offline) |
| **Stock** | Tabla de artículos con stock por ubicación | Cards con búsqueda |
| **Finanzas** | Resumen ingresos/egresos por período y por presupuesto | Tarjetas resumen |
| **Ajustes** | Usuarios, Roles, Empresa, Numeración, Plantillas, IA, Integraciones, Auditoría | Igual, en lista |

## 6. Estados vacíos y feedback
- Cada lista vacía explica qué es y ofrece la acción principal ("Todavía no hay obras para este cliente · + Nueva obra").
- Toasts para éxito; errores inline junto al campo.
- Skeletons en cargas; nunca spinners de pantalla completa.
- Las acciones destructivas siempre piden confirmación indicando el ID afectado.
