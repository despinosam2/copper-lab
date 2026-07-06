# 03 — MODEL SPEC · Especificación de los modelos

Los cinco modelos viven en `/src/models`. Este documento da las ecuaciones y su
interpretación económica. La prioridad es la **claridad**, no la eficiencia: cada
implementación se lee como pseudocódigo.

---

## 1. Modelo estructural del cobre (estilo Vial)

Idea: el precio surge del **balance oferta–demanda**, ajustado por inventarios,
tipo de cambio y costos de energía. Es determinista y totalmente transparente.

**Demanda** (crece con el ciclo industrial global):

```
D = D₀ · (1 + 0.9 · g)
```

**Oferta** (capacidad menos interrupciones):

```
S = S₀ · (1 − δ)
```

**Balance de mercado:**

```
B = S − D        (B > 0 superávit, B < 0 déficit)
```

**Precio** como base más aportes interpretables:

```
P = P₀ + demandPush + supplyPull + inventoryCushion + usdEffect + costFloor
```

donde:

| Término | Fórmula | Interpretación |
|---|---|---|
| `demandPush` | `0.9 · g · P₀` | Mayor crecimiento empuja el precio al alza |
| `supplyPull` | `δ · 1.8 · P₀` | Interrupciones de oferta encarecen el cobre |
| `inventoryCushion` | `−((inv−4)/4) · 0.35 · P₀` | Inventarios altos amortiguan el precio |
| `usdEffect` | `−((usd−100)/100) · 1.2 · P₀` | Dólar fuerte deprime el precio (cotiza en USD) |
| `costFloor` | `(energy−1) · 0.5 · P₀` | Energía cara sube el piso de costo |

Con `P₀ = 4.20 USD/lb`, `g` = crecimiento (%), `δ` = fracción de oferta
interrumpida, `inv` = semanas de inventario, `usd` = índice del dólar,
`energy` = costo de energía relativo.

**Valor pedagógico:** el precio no es magia; es una suma de efectos que el
estudiante puede aislar moviendo un slider a la vez.

---

## 2. ARIMA(p, d, 0)

Modela la serie usando **sólo su propio pasado**. Se diferencia `d` veces para
estabilizar la media y se ajusta un autorregresivo de orden `p`:

```
Δᵈyₜ = c + φ₁ Δᵈyₜ₋₁ + … + φₚ Δᵈyₜ₋ₚ + εₜ
```

Los coeficientes `φ` se estiman por **mínimos cuadrados ordinarios** (ecuaciones
normales resueltas por eliminación gaussiana). El pronóstico se reintegra `d`
veces para volver al nivel del precio.

**Limitación honesta:** omitimos el término de media móvil (MA, la "q" de ARIMA)
para mantener una estimación cerrada, sin optimización iterativa, que nunca falle
en vivo. Se documenta explícitamente: es ARIMA(p, d, 0).

**Valor pedagógico:** muestra cuánto se puede explicar con pura inercia temporal,
sin información económica.

---

## 3. ARIMAX

Extiende ARIMA agregando **regresores exógenos** X (variables económicas) al
mismo sistema lineal:

```
Δᵈyₜ = c + Σ φᵢ Δᵈyₜ₋ᵢ + Σ βⱼ Xⱼ,ₜ + εₜ
```

Aquí X puede incluir crecimiento global y el índice del dólar. Los `β` se estiman
junto con los `φ` por OLS.

**Valor pedagógico:** al comparar su RMSE con el de ARIMA, el estudiante ve
si las covariables aportan información real o no.

---

## 4. Gaussian Process Regression (GPR)

Regresión **no paramétrica** que entrega media y **incertidumbre**. Asume que la
serie es una muestra de un proceso gaussiano con kernel RBF:

```
k(x, x') = σf² · exp( −‖x − x'‖² / (2·l²) )
```

Predicción (con ruido de observación σn²):

```
media(x*)     = k*ᵀ (K + σn² I)⁻¹ y
varianza(x*)  = k(x*,x*) − k*ᵀ (K + σn² I)⁻¹ k*
```

La inversión se hace por **descomposición de Cholesky** (estable y legible). La
entrada es el índice temporal normalizado a [0,1].

Hiperparámetros:

- `l` (escala de longitud): suavidad. Pequeña ⇒ curva más flexible (sobreajuste).
- `σf²` (varianza de señal): amplitud de variaciones permitidas.
- `σn²` (varianza de ruido): cuánto ruido de observación se asume.

**Valor pedagógico:** la banda ±2σ enseña que un buen modelo **sabe cuánto no
sabe**. Es el único de los cinco que cuantifica incertidumbre.

---

## 5. Híbrido ARIMAX + GPR

Estrategia en dos etapas (*two-stage*):

1. **Etapa lineal:** ARIMAX captura tendencia, rezagos y covariables.
2. **Etapa no lineal:** se entrena un GPR sobre los **residuos** de ARIMAX, que
   pueden contener estructura no lineal que la parte lineal no ve.

Predicción combinada:

```
ŷ_híbrido = ŷ_ARIMAX + ŷ_GPR(residuos)
```

El GPR aporta además la banda de incertidumbre del pronóstico combinado.

**Valor pedagógico:** ilustra por qué combinar un modelo interpretable con uno
flexible puede mejorar el ajuste — y también cuándo **no** lo mejora (si ARIMAX
ya explicaba casi todo, la mejora es cercana a 0%, un resultado igual de válido).

---

## Métricas de comparación

Para actual `yₜ` y predicho `ŷₜ`:

```
RMSE = √( (1/n) Σ (yₜ − ŷₜ)² )
MAE  = (1/n) Σ |yₜ − ŷₜ|
MAPE = (100/n) Σ |(yₜ − ŷₜ) / yₜ|
```

**Advertencia pedagógica:** menor RMSE en el ajuste no garantiza mejor
generalización. El comparador es un punto de partida para la discusión, no un
veredicto.
