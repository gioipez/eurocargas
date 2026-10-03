import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Las fechas del wizard se calculan en hora local: se fija UTC para que los tests no dependan de la máquina.
process.env.TZ = "UTC";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
    include: ["src/**/*.test.{js,jsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/main.jsx", "src/test/**", "src/**/*.test.{js,jsx}"],
      reporter: ["text"],
    },
  },
});
