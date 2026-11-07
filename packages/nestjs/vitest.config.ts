import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Test against core's sources so a core build isn't required first.
      "@nestjs-observability/core": fileURLToPath(
        new URL("../core/src/index.ts", import.meta.url),
      ),
    },
  },
});
