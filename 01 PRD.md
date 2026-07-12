# 01 — PRD · Documento de Requisitos de Producto

> **Enmienda v2 (jul 2026):** el alcance descrito abajo ("cinco modelos", sin
> ampliarse) corresponde a la v1. La v2 amplió el alcance a 7 pestañas y 3
> modelos ML adicionales (Ridge, k-NN, bosque aleatorio) — ver
> [`07 VALIDACION SPEC.md`](07%20VALIDACION%20SPEC.md) y
> [`08 MANUAL.md`](08%20MANUAL.md). El resto de este documento (objetivo,
> usuarios, criterios de éxito) sigue vigente.

## Objetivo del producto

COPPER LAB es un software educativo que enseña modelado de precios de commodities
usando el cobre como caso de estudio. El objetivo es que un estudiante de magíster
**construya intuición sobre modelos econométricos manipulándolos directamente**,
en lugar de estudiarlos de forma abstracta.

La meta no es predecir el precio real del cobre, sino **entender cómo y por qué
cada modelo produce la predicción que produce**, y qué supuestos económicos hay
detrás.

## Usuarios

- **Usuario primario:** estudiante de Magíster en mercados de commodities, con
  base en economía y estadística pero no necesariamente en programación.
- **Usuario secundario:** profesor que usa la herramienta en vivo durante clase
  para demostrar conceptos y proponer experimentos.

## Alcance (in scope)

- Cinco modelos: estructural, ARIMA, ARIMAX, GPR, híbrido ARIMAX+GPR.
- Manipulación por sliders de variables económicas e hiperparámetros.
- Visualización de predicción vs. observado, con banda de incertidumbre en GPR.
- Comparación lado a lado de métricas de error (RMSE, MAE, MAPE).
- Dataset sintético reproducible + importación de CSV/Excel del usuario.
- Notas explicativas por pantalla.

## Fuera de alcance (out of scope)

- Backend, API, base de datos, autenticación, cuentas de usuario.
- Datos de mercado en tiempo real o conexión a fuentes externas obligatorias.
- Funciones de producto financiero: portafolios, órdenes, alertas, watchlists.
- Modelos adicionales fuera de los cinco definidos.
- Persistencia entre sesiones (más allá del archivo que el usuario importe).

## Funcionalidades

| # | Funcionalidad | Descripción |
|---|---|---|
| F1 | Panel de dataset | Ajustar semilla y ruido del dataset sintético; importar CSV/Excel |
| F2 | Modelo estructural | Sliders de crecimiento, oferta, inventario, dólar, energía; descomposición del precio |
| F3 | ARIMA | Ajustar órdenes p y d; ver ajuste y métricas |
| F4 | ARIMAX | ARIMA + activar/desactivar covariables exógenas |
| F5 | GPR | Ajustar hiperparámetros del kernel RBF; ver banda de incertidumbre |
| F6 | Híbrido | ARIMAX + GPR sobre residuos; ver mejora sobre ARIMAX solo |
| F7 | Comparador | Tabla con las métricas de los cuatro modelos ajustables |
| F8 | Notas pedagógicas | Explicación en lenguaje llano en cada pantalla |

## Criterios de éxito

- Un estudiante puede, sin ayuda, explicar la diferencia entre ARIMA y ARIMAX
  tras cinco minutos con la herramienta.
- La app nunca produce un error visible ni un estado roto durante una demo.
- Todo el cálculo es instantáneo con el dataset por defecto.
