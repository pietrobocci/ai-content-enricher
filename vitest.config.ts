import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // I test di contratto chiamano la rete: esclusi dalla suite normale.
    exclude: ["tests/**/*.contract.test.ts", "node_modules/**"],
  },
  resolve: {
    alias: { "@": path.resolve(process.cwd(), "src") },
  },
});
