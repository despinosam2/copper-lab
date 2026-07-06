import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// base: "./" — RNF-8: compila a estáticos y funciona bajo cualquier subruta (GitHub Pages).
// viteSingleFile: empaqueta todo en un único index.html portable.
export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile()],
  server: { host: "127.0.0.1", port: Number(process.env.PORT) || 5173 },
});
