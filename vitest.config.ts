import { defineConfig } from "vitest/config";

// Configuración de pruebas (R01, 09 EXECUTION BLUEPRINT). Los modelos y el
// parser son funciones puras sin DOM, así que el entorno 'node' basta y evita
// cargar el plugin de React o vite-plugin-singlefile del build de producción.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
