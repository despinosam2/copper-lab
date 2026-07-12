# 05 — UI SPEC · Sistema visual "instrumento científico"

> **Enmienda v2 (jul 2026):** la referencia a "pestañas numeradas (01–06)"
> más abajo corresponde a la v1. La v2 agregó la pestaña 07 (Predicción) —
> ver [`07 VALIDACION SPEC.md`](07%20VALIDACION%20SPEC.md) — con el mismo
> sistema visual descrito en este documento, sin cambios de paleta,
> tipografía ni componentes.

## Concepto

COPPER LAB debe verse como un **instrumento de laboratorio**, no como una app
financiera ni un dashboard genérico. La metáfora es un panel de medición: superficie
oscura de banco de trabajo, diales machinados, lecturas en fuente monoespaciada,
acentos en los dos colores del cobre — el metal crudo y su óxido (pátina/verdigris).

Esta paleta se elige deliberadamente para **no** caer en los defaults de diseño
generado por IA (crema + terracota, o negro + verde ácido). El verdigris nace del
propio tema: es literalmente el color del cobre oxidado.

## Paleta de colores

| Rol | Nombre | Hex |
|---|---|---|
| Fondo instrumento | `slate.900` | `#12161a` |
| Superficie panel | `slate.850` | `#171c22` |
| Borde/divisor | `slate.700` | `#28313b` |
| Acento primario (pátina/óxido) | `patina` | `#4fb3a0` |
| Pátina clara | `patina.light` | `#79d4c2` |
| Cobre metálico (dato/modelo) | `copper.light` | `#e0a274` |
| Cobre profundo | `copper.deep` | `#9a5a36` |
| Texto principal | `ink.100` | `#e8ecef` |
| Texto secundario | `ink.300` | `#aab4bd` |
| Texto tenue / unidades | `ink.500` | `#78838d` |

Uso semántico: la **línea observada** es gris tenue (`ink.500`), la **línea del
modelo** es cobre (`copper.light`), y la **incertidumbre** es pátina translúcida.

## Tipografía

- **Display** (títulos, marca): *Space Grotesk* — geométrica, técnica, con carácter.
- **Body** (texto, notas): *Inter* — legible y neutra.
- **Mono/lectura** (números, readouts, eyebrows): *IBM Plex Mono* — evoca un panel
  de medición y alinea dígitos (`tabular-nums`).

Escala: marca 20px/bold, títulos de panel 18px/semibold, readouts 24px, eyebrows
11px en mayúsculas con tracking amplio (0.2em).

## Layout

- Contenedor central máx. 1152px (`max-w-6xl`), respiración generosa.
- Cabecera fija con la marca y el contexto del curso.
- Barra de dataset persistente bajo la cabecera.
- Navegación por pestañas numeradas (01–06): la numeración **sí** codifica una
  secuencia pedagógica real (de lo estructural a lo híbrido al comparador).
- Cada pantalla de modelo: rejilla de dos columnas — gráfico/lecturas a la
  izquierda, controles (sliders) a la derecha; colapsa a una columna en móvil.

## Componentes

- **Panel:** superficie con borde sutil, radio de 3px (aspecto "placa"), eyebrow +
  título.
- **Slider:** pista fina; pomo con degradado radial cobre (aspecto de dial
  machinado) y halo de foco en pátina.
- **Readout:** lectura numérica grande en mono, con etiqueta eyebrow.
- **Nota:** bloque con barra lateral de pátina para las explicaciones pedagógicas.
- **Tabs:** subrayado en pátina para la activa; número en mono a la izquierda.

## Comportamiento visual

- Textura de rejilla muy tenue en el fondo (líneas a 32px) que evoca papel
  milimetrado de laboratorio.
- Transición de entrada por pestaña con Framer Motion (fade + leve desplazamiento),
  sutil y breve (~250 ms).
- **Movimiento reducido:** con `prefers-reduced-motion` las animaciones se anulan.
- **Foco:** contorno visible en pátina para navegación por teclado.

## Firma (elemento memorable)

El **degradado cobre→pátina** —del metal crudo a su óxido— aparece en el logotipo
y en el pomo de los sliders. Es el sello que ata toda la interfaz al tema del cobre
y la distingue de cualquier plantilla genérica.
