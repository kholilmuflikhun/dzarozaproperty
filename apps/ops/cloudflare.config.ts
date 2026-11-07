import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  accountId: "223cdd4731ebaaad4fc827fe00f002a3",
  worker: defineWorker({
    name: "dzaroza-ops-preview",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-07",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      DOCUMENTS: bindings.r2({ name: "dzaroza-ops-preview" }),
    },
  }),
});
