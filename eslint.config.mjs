import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["components/graph/graph-canvas.tsx", "components/graph/snapshot-modal.tsx"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  {
    files: [
      "components/graph/graph-canvas.tsx",
      "components/ui/carousel.tsx",
      "components/ui/use-mobile.tsx",
      "hooks/use-mobile.ts",
      "hooks/use-sound.ts",
    ],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  {
    files: ["components/graph/graph-canvas.tsx"],
    rules: { "react-hooks/refs": "off" },
  },
  {
    files: ["components/ui/sidebar.tsx"],
    rules: { "react-hooks/purity": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
])
