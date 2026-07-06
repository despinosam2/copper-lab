# 06 — DATA SPEC · Especificación del dataset

## Estructura del dataset

Serie **mensual**. Cada fila (`CopperRow`) tiene:

| Columna | Tipo | Descripción |
|---|---|---|
| `date` | string `YYYY-MM` | Mes de la observación |
| `t` | number | Índice temporal (0, 1, 2, …) |
| `price` | number | Precio del cobre en USD/lb |
| `globalGrowth` | number | Crecimiento industrial global (%) — covariable |
| `usdIndex` | number | Índice del dólar (~90–110) — covariable |

El dataset por defecto tiene 96 meses (8 años) desde enero de 2015.

## Relaciones económicas incorporadas

El generador construye el precio con estructura **conocida**, para que los modelos
puedan verificarse contra la verdad:

```
price = tendencia + estacionalidad + efecto_covariables + error_AR(1)
```

- **Tendencia:** deriva lenta al alza, `3.2 + 0.012·t`.
- **Estacionalidad:** ciclo anual, `0.25·sin(2π·t/12)`.
- **Efecto de covariables:** el precio sube con el crecimiento y baja con un dólar
  fuerte: `0.18·(growth−2.5) − 0.03·(usd−100)`.
- **Error AR(1):** `εₜ = 0.6·εₜ₋₁ + ruido·N(0,1)` — autocorrelación realista.

Las covariables mismas son cíclicas con ruido, imitando el comportamiento de
variables macro observadas.

## Cómo se generan los datos

- **PRNG determinista** (mulberry32) sembrado por el usuario ⇒ reproducibilidad
  total en clase.
- El ruido gaussiano se obtiene por transformación Box–Muller sobre el PRNG.
- Parámetros ajustables por el usuario: `seed` (1–200) y `noise` (0.02–0.25).

Motivación pedagógica: al conocer el proceso generador, el estudiante puede juzgar
si un modelo recupera la señal real o si se está ajustando al ruido.

## Importación de CSV / Excel

El usuario puede reemplazar el dataset sintético por su propio archivo (`.csv`,
`.xlsx`, `.xls`), leído en el navegador con SheetJS.

### Columnas reconocidas (con alias flexibles)

| Campo | Alias aceptados |
|---|---|
| precio (obligatorio) | `price`, `Price`, `precio` |
| fecha (opcional) | `date`, `Date`, `fecha` |
| crecimiento (opcional) | `globalGrowth`, `growth` |
| dólar (opcional) | `usdIndex`, `usd` |

Si faltan las covariables, se usan valores por defecto (crecimiento 2.5, dólar 100).

## Validación

La función `validateRows` aplica estas reglas antes de aceptar un archivo:

1. El archivo debe contener al menos una fila.
2. Cada fila debe tener un `price` **numérico**.
3. Cada `price` debe ser **positivo**.

Si hay errores, se muestran los primeros (hasta tres) al usuario y **no** se
reemplaza el dataset actual — la app nunca queda en un estado roto. Si la lectura
del archivo falla por completo, se informa con un mensaje claro y accionable.
