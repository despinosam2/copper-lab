# COPPER LAB

**App en vivo: https://despinosam2.github.io/copper-lab/**

Software educativo para construir intuición sobre modelos econométricos de
precios de commodities, usando el cobre como caso de estudio. Todo el cálculo
ocurre en el navegador: sin backend, API ni base de datos.

Cada push a `main` se despliega automáticamente a GitHub Pages (ver
`.github/workflows/deploy.yml`). Para estudiar con la herramienta, ver
[GUIA DE ESTUDIO.md](GUIA%20DE%20ESTUDIO.md).

Las especificaciones viven en los documentos `01 PRD.md` … `06 DATA SPEC.md`.

## Pantallas

| # | Pantalla | Contenido |
|---|---|---|
| 01 | Estructural | Escenario oferta–demanda con 5 sliders y descomposición del precio |
| 02 | ARIMA | ARIMA(p, d, 0) por mínimos cuadrados |
| 03 | ARIMAX | ARIMA + covariables exógenas activables |
| 04 | GPR | Regresión de proceso gaussiano con banda ±2σ |
| 05 | Híbrido | ARIMAX + GPR sobre residuos |
| 06 | Comparador | RMSE / MAE / MAPE de los cuatro modelos ajustables |

La barra superior controla el dataset: semilla y ruido del generador sintético
(96 meses, determinista) o importación de un CSV/Excel propio con columna
`price`/`precio`.

## Desarrollo

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # tsc + vite build → dist/index.html (archivo único portable)
npm run preview  # sirve el build de producción
```

El build usa `base: "./"` y `vite-plugin-singlefile`, así que `dist/index.html`
funciona en GitHub Pages bajo cualquier subruta, o abriéndolo directamente.

## Stack

React · TypeScript · Vite · TailwindCSS · Recharts · Framer Motion · SheetJS
