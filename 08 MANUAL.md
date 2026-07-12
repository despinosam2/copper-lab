# 08 — MANUAL · Manual de Usuario y Referencia Técnica

**COPPER LAB v2.1** · https://despinosam2.github.io/copper-lab/
Repositorio: https://github.com/despinosam2/copper-lab

---

## 1 · Introducción

### Propósito

COPPER LAB es un laboratorio interactivo para **construir intuición sobre
modelos econométricos y de machine learning aplicados a precios de
commodities**, usando el cobre como caso de estudio. Está dirigido a
estudiantes de magíster en mercados de commodities y al profesor que lo usa
en vivo durante la clase.

### El problema que resuelve

Los modelos de series de tiempo se enseñan tradicionalmente como ecuaciones
en una pizarra: el estudiante las memoriza sin sentir qué hace cada
parámetro. COPPER LAB invierte ese flujo: **cada parámetro es una perilla**,
y el efecto de moverla se ve al instante sobre datos reales o sintéticos.
La pregunta pedagógica central que la app permite responder empíricamente es:

> *¿Qué separa un modelo que ajusta bien de un modelo que predice bien?*

### Principios de diseño (heredados de las especificaciones 01–07)

| Principio | Significado práctico |
|---|---|
| **Transparencia** (RNF-7) | Ningún cálculo ocurre en caja negra: todo modelo está implementado en el propio código, legible como pseudocódigo. No se usan librerías de ML. |
| **Determinismo** (RNF-2) | Misma semilla ⇒ mismo dataset ⇒ mismos resultados. Incluso el bosque aleatorio usa semilla fija. |
| **Robustez** (RNF-3) | Toda entrada está acotada por sliders o validación; la app no puede quedar en estado roto durante una demo. Ningún cálculo usa optimización iterativa que pueda divergir. |
| **100% navegador** (RNF-1) | Sin backend, API ni base de datos. Los datos importados **nunca salen del navegador del usuario**. |

---

## 2 · Guía de Usuario

### 2.0 Acceso y requisitos

- **URL:** https://despinosam2.github.io/copper-lab/ — funciona en cualquier
  navegador moderno, escritorio o móvil. No requiere cuenta ni instalación.
- **Uso sin internet:** una vez cargada, la app funciona offline. También se
  puede guardar la página (Cmd/Ctrl+S) — es un único archivo HTML portable.

### 2.1 Barra de datos (siempre visible)

Controla la **fuente de datos única** de toda la app: cambiar el dataset
recalcula las siete pestañas simultáneamente.

| Control | Rango | Efecto |
|---|---|---|
| **Semilla** | 1–200 | Regenera el dataset sintético (96 meses desde 2015-01) con otra realización del mismo proceso. |
| **Ruido** | 0.02–0.25 | Desviación del error AR(1) del generador: más ruido = problema objetivamente más difícil para todos los modelos. |
| **Importar CSV/Excel** | `.csv` `.xlsx` `.xls` | Reemplaza el dataset sintético por datos propios. |
| **Restaurar Sintético** | — | Vuelve al generador (aparece sólo con datos importados). |

**Explicación del flujo — importación:**

1. El archivo se lee **en el navegador** con SheetJS (primera hoja solamente).
2. Las columnas se reconocen por alias, sin distinguir mayúsculas ni
   espacios: `price/precio` (obligatoria), `date/fecha/periodo` (opcional;
   también la primera columna sin encabezado), `growth/pindustrial/crecimiento`,
   `usd/dolarindex`, `stocks/inventarios`, `libor`, `partlargas`.
3. Filas con **precio vacío se omiten** (típico de filas de proyección al
   final de datasets reales); filas con precio no numérico o ≤ 0 **rechazan
   el archivo completo** con mensajes de error (máximo 3).
4. Covariables ausentes reciben valores neutros (crecimiento 2.5, dólar 100,
   stocks 4, libor 100, posición 0.7).
5. Si la validación falla, **el dataset anterior se conserva** — la app nunca
   queda vacía.

> El archivo del curso (`Datos Modelo Trimestral`) importa 131 trimestres
> 1986Q1–2018Q3 con las 5 covariables; los precios están en ¢USD/lb.

### 2.2 Pestaña 01 · Estructural

Dos herramientas en una pantalla:

**Escenario estático (arriba):** cinco sliders económicos (crecimiento,
interrupción de oferta, inventarios, dólar, energía) → precio de equilibrio y
su **descomposición en barras**: cada barra es el aporte de un factor sobre
la base P₀ = 4.20 USD/lb. Flujo sugerido: mover **un slider a la vez** y leer
qué barra cambia.

**Simulador dinámico (abajo):** las cuatro ecuaciones de Vial/Labys acopladas
en el tiempo, simuladas 40 trimestres. Sliders de elasticidades (εD, εS),
rezago de oferta (L), sensibilidad a inventarios (φ), crecimiento de actividad
y un shock de oferta puntual. Readouts: amplitud del ciclo, cobertura mínima
de inventarios, precio máximo y régimen (estable/oscilando).
Experimento clave: **L=8 con εD=0.1 → ciclo de telaraña persistente**.

### 2.3 Pestaña 02 · ARIMA

Sliders **p** (rezagos, 1–6) y **d** (diferenciaciones, 0–2). El gráfico
muestra el ajuste un-paso-adelante sobre la serie; abajo RMSE/MAE/MAPE/R² y
los coeficientes φ estimados. Experimento clave: p=2 fijo, comparar d=0 vs
d=1 en una serie con tendencia.

### 2.4 Pestaña 03 · ARIMAX

ARIMA + covariables exógenas activables (checkboxes): crecimiento, dólar,
inventarios, libor, posición especulativa. Los coeficientes β aparecen en el
panel de análisis. Dos flujos:

- **Manual:** apagar todas las covariables (≡ ARIMA), encenderlas una a una y
  observar el cambio en RMSE y los β.
- **Botón "Autoajustar (BIC)":** prueba las 576 combinaciones de p, d y
  covariables y mueve todos los controles a la de menor BIC (§3.8). Tarda
  ~1–2 s con indicador "Calculando…".

### 2.5 Pestaña 04 · GPR

Regresión de proceso gaussiano sobre el índice temporal, con banda de
incertidumbre. Controles:

- **l** (escala de longitud), **σf²** (varianza de señal), **σn²** (varianza
  de ruido) — los tres hiperparámetros del kernel RBF.
- **Banda ±1σ/±2σ**: 68% vs 95% de cobertura (la presentación del curso usa
  1σ). Cambiarla **no** altera las métricas: es solo visualización.
- **Botón "Autoajustar (verosimilitud marginal)"**: búsqueda en grilla del
  máximo de la verosimilitud marginal (§3.5).

Experimento clave: bajar **l al mínimo** → la curva persigue el ruido, el
RMSE "mejora" y la banda se estrecha: el sobreajuste y su mentira.

### 2.6 Pestaña 05 · Híbrido

ARIMAX (con las 5 covariables) + GPR entrenado sobre sus residuos. Controles:
p, d de la etapa lineal y l del GPR de residuos (σf²=1.0 y σn²=0.05 fijos).
El readout central es la **MEJORA (RMSE)** sobre ARIMAX solo. Experimento
clave: buscar mejora ≈ 0% (l grande) y discutir qué significa — los residuos
ya eran ruido; ARIMAX capturaba todo lo capturable.

### 2.7 Pestaña 06 · Comparador

Tabla RMSE/MAE/MAPE/R² de los cuatro modelos ajustables, **con la
configuración que quedó en cada pestaña** (columna "Configuración" para
trazabilidad). El punto verde marca el menor RMSE. Advertencia integrada:
es ajuste dentro de muestra — el veredicto honesto está en la pestaña 07.

### 2.8 Pestaña 07 · Predicción (v2)

La capa de evaluación honesta. **Explicación del flujo completo:**

1. **Elegir el % de entrenamiento** (50–90%). El corte es cronológico: el
   modelo aprende con el pasado y predice el tramo final que nunca vio. La
   línea vertical del gráfico marca el corte; la curva pátina es el ajuste
   en entrenamiento y la cobre la predicción en prueba.
2. **Elegir el modelo** (selector): los 4 del curso usan su configuración de
   pestaña; los 3 de ML (Ridge, k-NN, Bosque aleatorio) tienen sus propios
   controles, incluido el toggle **"Diferenciar (predecir Δprecio)"**.
3. **Leer los cuatro readouts**: RMSE de entrenamiento, RMSE de prueba,
   **degradación %** (la lección central: cuánto peor es el error en datos
   no vistos) y R² de prueba.
4. **GPR — dos modos**: *Un paso* (re-entrena con cada dato nuevo; comparable
   con el resto — default) y *Extrapolación* (predice todo el tramo de una
   vez: la media revierte a la histórica y la banda se ensancha — espera
   métricas mucho peores; no es un error).
5. **Walk-forward**: divide el tramo posterior al corte en k folds (3–6) y
   valida con origen rodante. "Validar los 7 modelos" produce el ranking
   honesto con media ± σ (la σ mide estabilidad entre cortes).
6. **Importancia de variables**: re-ajusta el modelo quitando cada covariable
   y mide cuánto empeora el RMSE **de prueba** (ablación). Barra cobre =
   aporta; barra pátina ≈ 0 = prescindible en presencia de las demás.

### 2.9 Proyección a futuro (v2.2, dentro de la pestaña 07)

Al final de la pestaña 07: pronóstico **recursivo** h períodos más allá del
último dato (slider 1–24, default 12). El modelo se estima con todo el
histórico y se alimenta de sus propias predicciones — los errores se
acumulan paso a paso, a diferencia del resto de la pestaña (un paso adelante
con historia real).

- **Exógenas futuras** (ARIMAX/Híbrido): constantes en su último valor
  observado por defecto; sliders de tasa %/período para explorar escenarios.
  Es una proyección **condicional** al escenario, no una predicción de esas
  variables.
- **Cortacircuito:** si la recursión excede máx/mín histórico ± 3× el rango,
  el punto se trunca y se marca en rojo — no confíes en ese tramo (riesgo
  clásico del pronóstico recursivo cerca de raíz unitaria).
- **GPR:** extrapola sin recursión — la media revierte a la histórica y la
  banda se ensancha ("aquí ya no sé").
- **Advertencia:** esto NO es una predicción del precio real del cobre; el
  propósito de la app es entender los modelos, no predecir el mercado.

### Flujos de trabajo típicos

**Estudiante (secuencia de la guía de estudio):** pestañas 01→07 en orden,
una por sesión, con los experimentos de cada nota al pie.

**Análisis de datos propios:** Importar CSV → pestaña 07 → "Autoajustar sin
fuga (sólo entrenamiento)" → "Validar los 7 modelos" → "Medir importancia".

> **Por qué no usar el "Autoajustar (BIC)" de la pestaña 03 antes de
> validar:** ese botón ve la serie completa, incluido el tramo de prueba —
> si luego evalúas "out-of-sample" con una configuración elegida mirando
> esos mismos datos, el resultado está optimistamente sesgado (fuga de
> selección). El botón de la pestaña 07 existe justo para evitar esto: sólo
> ve `data.slice(0, trainEnd)`. Los botones de las pestañas 03/04 siguen
> siendo útiles para explorar el ajuste in-sample (su propósito original),
> simplemente no son el punto de partida correcto para la pestaña 07.

---

## 3 · Fundamentos Técnicos y Matemáticos

### 3.1 Generador de datos sintéticos (`src/data/generator.ts`)

El precio se construye con estructura **conocida**, para poder juzgar si un
modelo recupera la señal o ajusta el ruido:

$$P_t = \underbrace{3.2 + 0.012\,t}_{\text{tendencia}} + \underbrace{0.25\sin\!\left(\tfrac{2\pi t}{12}\right)}_{\text{estacionalidad}} + \underbrace{0.18(g_t - 2.5) - 0.03(u_t - 100)}_{\text{covariables}} + \varepsilon_t$$

con error autocorrelacionado AR(1):

$$\varepsilon_t = 0.6\,\varepsilon_{t-1} + \sigma\,\eta_t,\qquad \eta_t \sim \mathcal{N}(0,1)$$

donde $\sigma$ es el slider de "ruido". Las covariables ($g_t$ crecimiento,
$u_t$ dólar, más stocks, libor y posición especulativa) son ciclos senoidales
con ruido propio. La aleatoriedad proviene del PRNG **mulberry32** sembrado
por el usuario, con normales generadas por **Box–Muller**:

$$\eta = \sqrt{-2\ln U_1}\,\cos(2\pi U_2),\qquad U_1, U_2 \sim \mathcal{U}(0,1)$$

### 3.2 Modelo estructural estático (`src/models/structural.ts`)

No hay estimación: es una identidad contable de efectos económicos sobre una
base $P_0 = 4.20$ USD/lb:

$$P = P_0 + \underbrace{0.9\,g\,P_0}_{\text{demandPush}} + \underbrace{1.8\,\delta\,P_0}_{\text{supplyPull}} - \underbrace{\tfrac{inv-4}{4}\,0.35\,P_0}_{\text{inventoryCushion}} - \underbrace{\tfrac{usd-100}{100}\,1.2\,P_0}_{\text{usdEffect}} + \underbrace{(e-1)\,0.5\,P_0}_{\text{costFloor}}$$

con $g$ = crecimiento (fracción), $\delta$ = oferta interrumpida (fracción),
$inv$ = semanas de inventario, $e$ = costo de energía relativo. El balance de
mercado es $B = S - D$ con $D = 25(1+0.9g)$ y $S = 25(1-\delta)$ Mt.

### 3.3 Simulador dinámico (`src/models/structuralDynamic.ts`)

Versión discreta del modelo estructural estándar (Vial 1988/2003; Labys
2006), iterada 40 trimestres:

$$D_t = \bar{D}\,A_t\left(\frac{P_{t-1}}{\bar{P}}\right)^{-\varepsilon_D} \qquad Q_t = \bar{Q}\left(\frac{P_{t-L}}{\bar{P}}\right)^{\varepsilon_S}(1-\delta_t)$$

$$I_t = I_{t-1} + Q_t - D_t \qquad P_t = P_{t-1} + \lambda\left[\bar{P}\left(\frac{I^*}{I_t}\right)^{\phi} - P_{t-1}\right]$$

con $\lambda = 0.15$ (velocidad de ajuste, calibrada por barrido numérico
para que el escenario base converja y la telaraña oscile sin saturar),
$\bar{P}=4.2$, $\bar{D}=\bar{Q}=6.25$ Mt/trim, $I^* = \bar{D}\cdot 4/13$
(4 semanas de cobertura). Salvaguardas: piso de inventario $0.05\,I^*$ y
cortacircuito de precio $[0.25\bar{P},\,4\bar{P}]$.

**Por qué el rezago L genera ciclos:** la oferta responde al precio de hace
$L$ trimestres; cuando llega, la demanda ya cambió → sobre-reacción →
oscilación tipo telaraña (cobweb). Estable con $\varepsilon_D$ alto y $L$
corto; oscilante con lo contrario.

### 3.4 ARIMA(p, d, 0) y ARIMAX (`src/models/arima.ts`, `arimax.ts`)

**Diferenciación** ($d$ veces) para estabilizar la media:
$\Delta y_t = y_t - y_{t-1}$.

**Estimación** del autorregresivo (más exógenas contemporáneas $X$ en
ARIMAX) por **mínimos cuadrados ordinarios**:

$$\Delta^d y_t = c + \sum_{i=1}^{p}\varphi_i\,\Delta^d y_{t-i} + \sum_{j}\beta_j X_{j,t} + \epsilon_t$$

resuelto por ecuaciones normales $\hat\beta = (X^\top X + 10^{-8}I)^{-1}X^\top y$
(el ridge diminuto evita singularidad con covariables colineales; la
inversión es Gauss-Jordan con pivoteo — `src/models/matrix.ts`).

**Reintegración un-paso con historia real** al nivel del precio:

$$\hat{y}_t = \begin{cases} \widehat{\Delta^0 y}_t & d=0\\ y_{t-1} + \widehat{\Delta y}_t & d=1\\ 2y_{t-1} - y_{t-2} + \widehat{\Delta^2 y}_t & d=2 \end{cases}$$

**Limitación documentada:** se omite el término MA (la "q") para que la
estimación sea cerrada, sin optimización iterativa que pueda fallar en vivo.

### 3.5 GPR — proceso gaussiano (`src/models/gpr.ts`)

Prior gaussiano sobre funciones con **kernel RBF**:

$$k(x,x') = \sigma_f^2\exp\!\left(-\frac{(x-x')^2}{2\,\ell^2}\right)$$

con $x = t/(n-1) \in [0,1]$ el índice temporal normalizado. La serie se
**estandariza** ($\tilde{y} = (y-\mu_y)/\sigma_y$) para que los
hiperparámetros signifiquen lo mismo en USD/lb que en ¢/lb; media y varianza
se des-estandarizan al final.

**Posterior predictivo** (media y varianza en cada punto $x_*$):

$$\mu(x_*) = \mathbf{k}_*^\top (K + \sigma_n^2 I)^{-1}\tilde{\mathbf{y}} \qquad \sigma^2(x_*) = k(x_*,x_*) + \sigma_n^2 - \mathbf{k}_*^\top (K + \sigma_n^2 I)^{-1}\mathbf{k}_*$$

La inversión nunca se hace explícita: se factoriza $K+\sigma_n^2 I = LL^\top$
(**Cholesky**, estable para matrices definidas positivas) y se resuelven dos
sistemas triangulares. La banda dibujada es $\mu \pm z\sigma$ con $z \in \{1,2\}$.

**Autoajuste — verosimilitud marginal.** El criterio estándar (Rasmussen &
Williams, cap. 5):

$$\log p(\mathbf{y}\mid X) = -\tfrac{1}{2}\tilde{\mathbf{y}}^\top\alpha - \sum_i \log L_{ii} - \tfrac{n}{2}\log 2\pi,\qquad \alpha = (K+\sigma_n^2I)^{-1}\tilde{\mathbf{y}}$$

El primer término premia el ajuste; el segundo ($\log\det$) **penaliza la
complejidad automáticamente** — por eso maximizarla no elige el modelo más
flexible. La búsqueda es una **grilla logarítmica 6×6×6** sobre los rangos de
los sliders (no descenso por gradiente: siempre termina, nunca diverge),
asíncrona con cesión de hilo.

### 3.6 Híbrido (`src/models/hybrid.ts`)

Estrategia en dos etapas: $\hat{y}^{hib}_t = \hat{y}^{ARIMAX}_t + \hat{r}^{GPR}_t$,
donde el GPR se entrena sobre los residuos $r_t = y_t - \hat{y}^{ARIMAX}_t$.
Si los residuos ya son ruido blanco, el GPR no encuentra estructura y la
mejora es ≈ 0% — un resultado nulo informativo. La optimización es
secuencial (two-stage), no conjunta: limitación conocida a cambio de
simplicidad y estabilidad.

### 3.7 Modelos de ML (`src/models/ml.ts`)

Características comunes: $[y_{t-1},\dots,y_{t-\text{lags}},\; X_{1,t},\dots,X_{5,t}]$,
estandarizadas con estadísticos **del entrenamiento solamente** (sin fuga de
información).

**Ridge** — regresión regularizada en forma cerrada:

$$\hat\beta = (X^\top X + \lambda m I)^{-1} X^\top y$$

$\lambda$ encoge los coeficientes hacia 0: el mismo trade-off sesgo/varianza
que $\sigma_n^2$ en el GPR, en versión lineal.

**k-NN** — la predicción es el promedio del precio en los $k$ puntos
históricos más cercanos (distancia euclídea estandarizada). Dentro del
entrenamiento cada punto es su propio vecino: con $k=1$ el ajuste de
entrenamiento es perfecto — sobreajuste de manual, a propósito.

**Bosque aleatorio** — ensemble de árboles de regresión: cada árbol se
entrena con una muestra bootstrap y en cada nodo sólo considera
$\lceil\sqrt{F}\rceil$ características al azar; el corte minimiza la suma de
errores cuadráticos (calculada con sumas prefijas en $O(1)$ por corte).
Predicción = promedio del bosque. **Determinista**: el PRNG usa semilla fija.

**Diferenciación (toggle "Δprecio").** Árboles y vecinos **no extrapolan**:
su salida es siempre un promedio de valores vistos, así que nunca predicen
sobre el máximo del entrenamiento — fatal con series con tendencia. El toggle
cambia el objetivo a $\Delta y_t$ y reintegra un-paso:

$$\hat{y}_t = y_{t-1} + \widehat{\Delta y}_t$$

— la misma idea que la $d$ de ARIMA, aplicada al ML. Con el dataset del curso
transforma al bosque del peor modelo (+130% de degradación) al mejor
(RMSE de prueba ≈ 18.7 ¢/lb).

### 3.8 Métricas y criterios de selección (`src/models/metrics.ts`, `arimaxTune.ts`)

$$\text{RMSE}=\sqrt{\tfrac{1}{n}\sum e_t^2}\quad \text{MAE}=\tfrac{1}{n}\sum|e_t|\quad \text{MAPE}=\tfrac{100}{n}\sum\left|\tfrac{e_t}{y_t}\right|\quad R^2 = 1-\tfrac{\sum e_t^2}{\sum(y_t-\bar{y})^2}$$

**BIC** para el autoajuste de ARIMAX:

$$\text{BIC} = m\ln\!\left(\frac{\text{RSS}}{m}\right) + k\ln m$$

con $k = 1 + p + (\text{covariables activas})$ y $m$ las observaciones
evaluadas. Clave metodológica: en OLS el RMSE dentro de muestra **nunca
empeora** al agregar parámetros, así que seleccionar por RMSE elegiría
siempre el modelo más complejo; el término $k\ln m$ es la penalización que
falta. Todos los candidatos se evalúan sobre la **misma muestra**
($t \geq p_{max}+d_{max} = 8$) para que sus BIC sean comparables.

### 3.9 Validación out-of-sample (`src/models/forecast.ts`, `evaluation.ts`)

**Principio:** separar *estimación* (solo con $t < t_{corte}$) de
*predicción* (coeficientes congelados aplicados a $t \geq t_{corte}$). La
predicción es **un paso adelante con historia real**: los rezagos usan
valores observados, y las exógenas de prueba son las observadas (pronóstico
*condicional*). Garantía verificada por script: con $t_{corte} = n$ las
funciones reproducen exactamente los resultados de las pestañas 02–05.

**GPR un-paso:** para cada punto de prueba se re-entrena con ventana
expansiva $[0, t)$ — la actualización natural del posterior. **GPR
extrapolación:** un solo ajuste; a distancia $\gg \ell$ del último dato,
$\mathbf{k}_* \to 0$, por lo que $\mu \to$ media del entrenamiento y
$\sigma^2 \to \sigma_f^2 + \sigma_n^2$ (banda máxima): el modelo declara "no
sé".

**Walk-forward (rolling origin):** el tramo posterior al corte se divide en
$k$ bloques; el fold $j$ entrena con $[0, b_j)$ y prueba $[b_j, b_{j+1})$.
Nunca se entrena con datos posteriores a la prueba — el k-fold barajado es
inválido en series de tiempo. Se reporta RMSE medio ± desviación entre folds
(estabilidad).

**Importancia por ablación:** $\text{imp}(v) = \text{RMSE}_{test}^{(sin\ v)} - \text{RMSE}_{test}^{(completo)}$,
re-ajustando sin cada covariable. Con covariables correlacionadas, una puede
sustituir a otra: importancia baja = "prescindible en presencia de las
demás", no "irrelevante".

### Explicación del flujo — cálculo reactivo

```
Barra de datos (semilla/ruido/import)
        │
        ▼
useDataset() ──── dataset activo (sintético o importado)
        │
        ▼
ModelParamsContext ── parámetros de las 7 pestañas (estado compartido:
        │             sobrevive al cambio de pestaña; el Comparador y la
        │             pestaña 07 leen la misma configuración)
        ▼
Vista activa ── useMemo(modelo(datos, parámetros))
        │       · recalcula sólo si cambian datos o parámetros
        │       · cálculos pesados (autoajustes, walk-forward, ablación):
        │         asíncronos con cesión de hilo + botón "Calculando…"
        ▼
Recharts (gráficos) + readouts (métricas)
```

---

## 4 · Arquitectura y Stack

### Stack

| Capa | Tecnología | Rol |
|---|---|---|
| UI | **React 18 + TypeScript** | Componentes y tipado estricto |
| Build | **Vite 5** + `vite-plugin-singlefile` | Compila TODO a un único `dist/index.html` portable |
| Estilos | **TailwindCSS 3** | Sistema visual "instrumento científico" (05 UI SPEC) |
| Gráficos | **Recharts 2** | Series, bandas de rango, barras |
| Animación | **Framer Motion 11** | Transiciones entre pestañas (respeta `prefers-reduced-motion`) |
| Datos | **SheetJS (xlsx)** | Lectura de CSV/Excel en el navegador |
| Numérico | **Propio** (`src/models/matrix.ts`) | OLS, Gauss-Jordan, Cholesky — sin librerías de ML (transparencia) |
| Deploy | **GitHub Actions → GitHub Pages** | Cada push a `main` compila y publica automáticamente |

### Estructura de carpetas

```
src/
├── data/          generator.ts (sintético) · parser.ts (import) · useDataset.ts
├── models/        arima · arimax · gpr · hybrid · structural · structuralDynamic
│                  forecast (out-of-sample) · ml (ridge/knn/forest) · evaluation
│                  arimaxTune (BIC) · matrix (álgebra lineal) · metrics
├── state/         ModelParams.tsx (contexto compartido) · exogDefs.ts
├── views/         una vista por pestaña (01–07)
├── components/    Chart · Panel · Slider · Readout · Note
└── App.tsx        pestañas + proveedor de estado
```

### Decisiones de arquitectura relevantes

1. **Estado compartido sobre las pestañas** (`ModelParamsContext`): las vistas
   se desmontan al cambiar de pestaña, así que los parámetros viven arriba.
   Beneficio doble: los sliders no se resetean, y el Comparador/pestaña 07
   evalúan exactamente la configuración que el usuario vio.
2. **Separación fit/predict sin tocar lo validado**: las funciones de la
   pestaña 07 (`forecast.ts`) son paralelas a las de las pestañas 02–05, no
   un refactor de ellas — cero riesgo de regresión, con un script de
   consistencia que verifica igualdad exacta en el caso límite.
3. **Patrón async con cesión de hilo**: todo cálculo > ~100 ms se ejecuta en
   trozos con `await setTimeout(0)` entre pasos, para que el navegador nunca
   se congele (lección aprendida: la primera versión del autoajuste GPR
   bloqueaba el hilo 3 s y parecía un cuelgue).
4. **Archivo único**: el build inline-a JS y CSS en un solo HTML → funciona
   en Pages bajo cualquier subruta, offline, o enviado por correo.

---

## 5 · Anexo A — Resolución de Problemas

| Síntoma | Causa | Qué hacer |
|---|---|---|
| "No se encontró una columna de precio" | El archivo no tiene columna `price`/`precio` | Renombrar la columna del precio; el matching ignora mayúsculas/espacios |
| "Fila N: El campo precio no es numérico" | Celdas con texto o formato local (coma decimal "4,23") | Corregir esas celdas; usar punto decimal |
| El archivo importa menos filas que el original | Filas con precio vacío se omiten (proyecciones) | Comportamiento esperado, no error |
| Métricas muestran "—" | Muy pocos datos para el modelo (p. ej. p+d ≥ n, o k > entrenamiento) | Usar serie más larga o reducir p/d/k; con n<25 aparece el aviso de datos insuficientes |
| GPR con métricas terribles en pestaña 07 | Modo "Extrapolación" activo | Es el comportamiento honesto de extrapolar sin información (la media revierte). Usar modo "Un paso" para comparar con otros modelos |
| Bosque/k-NN colapsan con datos con tendencia | Los árboles/vecinos no predicen sobre el máximo visto | Activar "Diferenciar (predecir Δprecio)" |
| Degradación negativa (prueba mejor que entrenamiento) | El tramo de prueba es menos volátil que el de entrenamiento | No es error: las métricas dependen del período tanto como del modelo |
| Cambiar la banda ±1σ/±2σ no cambia el RMSE | La banda es visualización de la varianza; la media no se toca | Comportamiento correcto |
| El "ganador" del Comparador cambia con la semilla | El ranking in-sample depende de la muestra | Es la lección: usar la pestaña 07 (walk-forward) para un veredicto estable |
| Mejora del híbrido ≈ 0% | Los residuos de ARIMAX ya eran ruido | Resultado nulo informativo, no falla |
| Botones quedan en "Calculando…" unos segundos | Autoajustes/walk-forward corren en el navegador | Normal: 1–5 s según dataset; el hilo no se congela |
| R² negativo en prueba | El modelo predice peor que la media constante en ese tramo | Interpretación válida: R² fuera de muestra puede ser < 0 |
| La app "no carga" cambios recién publicados | Caché del navegador/CDN de GitHub Pages | Recargar forzado (Cmd+Shift+R) o esperar ~1 min tras el deploy |
| Fechas raras tipo "1986.4" en el eje X | Formato numérico año.trimestre del archivo original | Cosmético; los cálculos usan el índice temporal, no la fecha |
| Los sliders de semilla/ruido no responden | Hay un dataset importado activo | "Restaurar Sintético" primero |

---

## 6 · Anexo B — Cómo pedir modificaciones a una IA

El código está diseñado para ser modificado con asistencia de IA. La calidad
del resultado depende casi por completo del **contexto** que se le entregue.

### Contexto mínimo que siempre debes dar

1. **El repositorio**: https://github.com/despinosam2/copper-lab (o acceso a
   la carpeta local). La IA debe **leer el código antes de tocar nada**.
2. **Los documentos de especificación** `01 PRD.md` … `08 MANUAL.md` — en
   particular las restricciones: transparencia (sin librerías de ML),
   determinismo, robustez, español en la UI, paleta "instrumento científico".
3. **Qué archivo(s) crees que están involucrados** si lo sabes (la tabla de
   estructura del §4 sirve de mapa).

### Plantilla de prompt óptimo

```text
Rol: Actúa como desarrollador senior de React/TypeScript trabajando en
COPPER LAB, una app educativa de modelos de precios del cobre.

Contexto: El repositorio es github.com/despinosam2/copper-lab. Lee primero
los documentos 01-08 (especificaciones y manual) y el código de [archivos
relevantes si los conoces]. La app corre 100% en el navegador, sin backend.

Restricciones que NO se negocian:
- Transparencia: nada de librerías de ML; los algoritmos se implementan
  legibles en src/models/.
- Determinismo: misma semilla => mismo resultado (PRNG mulberry32 sembrado).
- Robustez: sin optimización iterativa que pueda divergir; entradas acotadas
  por sliders; la app nunca queda en estado roto.
- Todo cálculo pesado (>100 ms) debe ser asíncrono con cesión de hilo y
  estado "Calculando…" (patrón existente en GprView/ValidationView).
- No modificar las funciones fitArima/fitArimax/fitGpr/fitHybrid (pestañas
  02-05, ya validadas): agregar funciones paralelas si hace falta, como hace
  src/models/forecast.ts.
- UI en español, paleta y componentes existentes (Panel, Slider, Note).

Tarea: [QUÉ quieres, en una frase]. [POR QUÉ / para qué escenario de clase].

Criterios de aceptación:
- [Comportamiento esperado, con números si los conoces]
- npx tsc --noEmit sin errores y npm run build exitoso.
- Verificar en el navegador con el dataset sintético Y con el Excel del
  curso (Datos Modelo Trimestral: 131 trimestres, precios en ¢/lb).
- Si toca cálculos existentes: verificar que las pestañas 02-06 dan los
  mismos números que antes.

Al terminar: commit descriptivo en español y push a main (el deploy a
GitHub Pages es automático; verificar que Actions termine en verde).
```

### Ejemplo aplicado (bueno vs. malo)

- ❌ *"Agrega un modelo LSTM a la app"* — sin contexto, viola la restricción
  de transparencia, no dice dónde ni para qué.
- ✅ *"Tarea: agregar un kernel periódico opcional al GPR de la pestaña 04
  (selector RBF/RBF+periódico), implementado legible en src/models/gpr.ts
  como el RBF existente. Para qué: mostrar en clase que la estacionalidad
  anual del dataset sintético se captura mejor componiendo kernels. Criterio:
  con el kernel compuesto y el dataset sintético (semilla 42, ruido 0.10),
  el RMSE debe bajar respecto del RBF puro con hiperparámetros autoajustados;
  las demás pestañas no cambian."*

### Reglas de oro al trabajar con la IA

1. **Pide verificación, no solo código**: exige que compile, que pruebe en
   navegador y que reporte los números que obtuvo.
2. **Una tarea por petición**: mezclar tres cambios en un prompt produce
   regresiones difíciles de aislar.
3. **Pide el porqué**: si la IA propone desviarse de una restricción, que lo
   justifique explícitamente antes de hacerlo.
4. **Datos de referencia**: el Excel del curso con ARIMA(1,1,0) debe dar
   RMSE ≈ 29.5 y con ARIMAX(2,1, 5 covariables) ≈ 26.1 — cualquier cambio
   que altere esos números sin explicación es una regresión.
