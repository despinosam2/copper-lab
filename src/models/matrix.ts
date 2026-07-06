export function transpose(m: number[][]): number[][] {
  if (m.length === 0) return [];
  const res: number[][] = [];
  for (let c = 0; c < m[0].length; c++) {
    res[c] = [];
    for (let r = 0; r < m.length; r++) {
      res[c][r] = m[r][c];
    }
  }
  return res;
}

export function multiply(a: number[][], b: number[][]): number[][] {
  const aRows = a.length;
  const aCols = a[0].length;
  const bCols = b[0].length;
  const res: number[][] = Array(aRows).fill(0).map(() => Array(bCols).fill(0));
  for (let r = 0; r < aRows; r++) {
    for (let c = 0; c < bCols; c++) {
      let sum = 0;
      for (let k = 0; k < aCols; k++) {
        sum += a[r][k] * b[k][c];
      }
      res[r][c] = sum;
    }
  }
  return res;
}

// Invert matrix using Gauss-Jordan elimination
export function invert(matrix: number[][]): number[][] {
  const n = matrix.length;
  const a = matrix.map(row => [...row]);
  const res = Array(n).fill(0).map((_, i) => {
    const row = Array(n).fill(0);
    row[i] = 1;
    return row;
  });

  for (let i = 0; i < n; i++) {
    let pivot = a[i][i];
    if (Math.abs(pivot) < 1e-10) {
      // Find a row to swap
      let swapRow = i + 1;
      while (swapRow < n && Math.abs(a[swapRow][i]) < 1e-10) swapRow++;
      if (swapRow === n) {
        // RNF-3: nunca romper la app. Regularizamos la diagonal en lugar de
        // lanzar una excepción (con el ridge de `ols` esto es inalcanzable).
        a[i][i] += 1e-8;
        pivot = a[i][i];
      } else {
        // Swap rows
        [a[i], a[swapRow]] = [a[swapRow], a[i]];
        [res[i], res[swapRow]] = [res[swapRow], res[i]];
        pivot = a[i][i];
      }
    }

    for (let j = 0; j < n; j++) {
      a[i][j] /= pivot;
      res[i][j] /= pivot;
    }

    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = a[k][i];
        for (let j = 0; j < n; j++) {
          a[k][j] -= factor * a[i][j];
          res[k][j] -= factor * res[i][j];
        }
      }
    }
  }
  return res;
}

export function ols(X: number[][], y: number[]): number[] {
  const yMat = y.map(v => [v]);
  const Xt = transpose(X);
  const XtX = multiply(Xt, X);
  // Ridge diminuto: evita sistemas singulares (p. ej. columnas colineales en
  // datos importados) sin alterar el resultado de forma visible (RNF-3).
  for (let i = 0; i < XtX.length; i++) XtX[i][i] += 1e-8;
  const XtX_inv = invert(XtX);
  const XtY = multiply(Xt, yMat);
  const beta = multiply(XtX_inv, XtY);
  return beta.map(row => row[0]);
}

// Cholesky decomposition A = L * L^T
export function cholesky(A: number[][]): number[][] {
  const n = A.length;
  const L = Array(n).fill(0).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }
      if (i === j) {
        L[i][j] = Math.sqrt(Math.max(0, A[i][i] - sum));
      } else {
        L[i][j] = (A[i][j] - sum) / L[j][j];
      }
    }
  }
  return L;
}

// Solve Lx = b
export function forwardSolve(L: number[][], b: number[]): number[] {
  const n = L.length;
  const x = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < i; j++) {
      sum += L[i][j] * x[j];
    }
    x[i] = (b[i] - sum) / L[i][i];
  }
  return x;
}

// Solve L^T x = b
export function backwardSolve(L: number[][], b: number[]): number[] {
  const n = L.length;
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
      sum += L[j][i] * x[j]; // L^T[i][j] = L[j][i]
    }
    x[i] = (b[i] - sum) / L[i][i];
  }
  return x;
}
