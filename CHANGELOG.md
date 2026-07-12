# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Reconstruido a partir del historial de git (hallazgo B7 de la auditoría de
julio 2026: la versión de `package.json` no coincidía con la que citaba el
manual).

## [Unreleased]

Mejoras derivadas de la auditoría técnica de julio 2026 (ver
`09 EXECUTION BLUEPRINT.md`), en curso — cada una en su propio PR:

- Suite de pruebas Vitest + puerta de calidad en CI (R01).
- Parser consciente de locale: coma decimal y detección de separador `;` (R02).
- Señalización de covariables rellenadas por defecto al importar (R03).
- Actualización de `xlsx` a 0.20.3 — cierra 2 CVEs *high* (R04).
- Techo de 2000 filas al importar + aviso de datos insuficientes global (R05).
- Autoajuste sin fuga de selección en la pestaña 07 (R06).
- Nota anti-sobreajuste al conjunto de prueba en los controles de ML (R07).
- `ErrorBoundary` + `calculateMetrics` devuelve `null` en vez de `0.000` (R08).
- Normalización del GPR unificada entre las pestañas 04 y 07 (R09).
- Licencia MIT + verificación de historia git del material privado (R10).
- Diagnóstico de residuos: ACF + Ljung-Box en ARIMA/ARIMAX (R11).
- Errores estándar y estadístico t de los coeficientes de ARIMAX (R12).
- Cesión de hilo entre folds del walk-forward (R13).
- Presets de experimento clicables + enlace a la guía de estudio (R14).

## [2.1.0] — jul 2026

- Diferenciación en los modelos de ML (toggle "Δprecio") para series con tendencia.
- Autoajuste por BIC en ARIMAX (576 combinaciones de p, d y covariables).
- Folds del walk-forward derivados del % de entrenamiento del slider (antes fijo en 60%).
- Guardas para datasets cortos.
- GPR comparable en la pestaña 07 (modo "un paso") + fix de la ablación de ARIMAX.
- Manual de usuario y referencia técnica (`08 MANUAL.md`).

## [2.0.0] — 2026

- Pestaña 07 "Predicción": validación out-of-sample (train/test, walk-forward
  rolling-origin, importancia de variables por ablación).
- Tres modelos de ML transparentes: Ridge, k-NN, bosque aleatorio determinista.

## [1.x] — 2025–2026

- R² en todas las vistas y el comparador.
- Banda de incertidumbre del GPR conmutable ±1σ/±2σ.
- Autoajuste de hiperparámetros del GPR por verosimilitud marginal.
- Tooltips compactos en los gráficos; más covariables disponibles en ARIMAX;
  color distinguible para la línea del Híbrido.

## [1.0.0] — 2025

- Lanzamiento inicial: cinco modelos (Estructural, ARIMA, ARIMAX, GPR,
  Híbrido) + Comparador.
