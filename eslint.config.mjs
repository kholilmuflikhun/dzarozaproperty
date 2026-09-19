import nextVitals from "eslint-config-next/core-web-vitals";
import { globalIgnores } from "eslint/config";

export default [
  globalIgnores(["**/*.d.ts"]),
  ...nextVitals,
  {
    rules: {
      "import/no-anonymous-default-export": "off",
      "react-hooks/set-state-in-effect": "off",
      "no-unused-vars": "warn",
      "prefer-const": "warn",
      eqeqeq: "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
];
