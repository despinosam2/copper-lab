# 02 — SRS · Especificación de Requisitos de Software

> **Enmienda v2 (jul 2026):** la restricción "Exactamente cinco modelos; el
> alcance no se amplía" (al final de este documento) corresponde a la v1. La
> v2 amplió el alcance a 7 pestañas y 3 modelos ML adicionales — ver
> [`07 VALIDACION SPEC.md`](07%20VALIDACION%20SPEC.md) y
> [`08 MANUAL.md`](08%20MANUAL.md). Los requisitos no funcionales (RNF-1 a
> RNF-8) siguen vigentes para toda la app, incluida la v2.

## Requisitos funcionales

| ID | Requisito |
|---|---|
| RF-1 | El sistema genera un dataset sintético mensual de precio del cobre con estructura conocida (tendencia + estacionalidad + covariables + ruido AR(1)). |
| RF-2 | El usuario puede ajustar la semilla (1–200) y el nivel de ruido (0.02–0.25) del dataset sintético, y los modelos se recalculan al instante. |
| RF-3 | El usuario puede importar un archivo CSV o Excel; el sistema valida que exista una columna de precio numérica y positiva. |
| RF-4 | El modelo estructural calcula el precio como suma de aportes interpretables a partir de cinco variables económicas, y muestra su descomposición. |
| RF-5 | El sistema ajusta un ARIMA(p,d,0) con p∈[1,6] y d∈[0,2] por mínimos cuadrados, y muestra el ajuste sobre la serie. |
| RF-6 | El sistema ajusta un ARIMAX con las mismas órdenes más covariables exógenas activables (crecimiento, dólar). |
| RF-7 | El sistema ajusta un GPR con kernel RBF, con hiperparámetros ajustables, y muestra una banda de incertidumbre ±2σ. |
| RF-8 | El sistema ajusta un modelo híbrido: ARIMAX más un GPR sobre sus residuos, y reporta la mejora en RMSE respecto de ARIMAX solo. |
| RF-9 | El comparador muestra RMSE, MAE y MAPE de los cuatro modelos ajustables, destacando el de menor RMSE. |
| RF-10 | Cada pantalla de modelo incluye una nota explicativa en lenguaje llano. |

## Requisitos no funcionales

| ID | Requisito |
|---|---|
| RNF-1 | **Ejecución 100% en navegador.** Sin backend, API, base de datos ni autenticación. |
| RNF-2 | **Determinismo.** Misma semilla ⇒ mismo dataset ⇒ mismos resultados. |
| RNF-3 | **Robustez.** Toda entrada de usuario está acotada por sliders o validación; el sistema no expone campos que puedan generar estados inválidos. |
| RNF-4 | **Rendimiento.** Recalcular cualquier modelo con el dataset por defecto (~96 puntos) es perceptualmente instantáneo (<100 ms). |
| RNF-5 | **Accesibilidad.** Foco de teclado visible, roles ARIA en tabs y sliders, y respeto por `prefers-reduced-motion`. |
| RNF-6 | **Responsividad.** Uso correcto desde móvil hasta escritorio. |
| RNF-7 | **Transparencia.** El código de cada modelo es legible e inspeccionable; ningún cálculo ocurre en una caja negra opaca. |
| RNF-8 | **Portabilidad de despliegue.** Compila a estáticos y funciona en GitHub Pages bajo cualquier subruta (`base: "./"`). |

## Comportamiento del sistema

- **Fuente de datos única:** un hook central (`useDataset`) entrega la serie
  activa —sintética o importada— a todas las pantallas. Cambiar el dataset
  actualiza todos los modelos simultáneamente.
- **Cálculo reactivo:** los modelos se recalculan de forma memoizada cuando
  cambian sus entradas (datos o hiperparámetros).
- **Degradación elegante:** si la importación falla, se muestra un mensaje claro
  y la app conserva el dataset previo. Si las fuentes remotas no cargan, se usan
  fuentes de sistema.

## Restricciones

- Stack cerrado: React, TypeScript, Vite, TailwindCSS, Recharts, Framer Motion,
  SheetJS.
- Exactamente cinco modelos; el alcance no se amplía.
- Sin dependencias que requieran servidor o clave de API.
