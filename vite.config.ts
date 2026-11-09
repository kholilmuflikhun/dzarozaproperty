import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { responseStoreServiceBinding } from "./cloudflare.config.ts";
import { responseStoreAdapter } from "@vinext/cloudflare/cache/response-store-adapter";
import { imagesOptimizer } from "@vinext/cloudflare/images/images-optimizer";

export default defineConfig({
  // Keep browser/client source maps unchanged. The Cloudflare Worker bundle
  // exceeded Cloudflare's 60 MiB encoded source-map upload limit in production.
  // Disable maps only for the server-side Worker environments (RSC + SSR).
  environments: {
    rsc: {
      build: { sourcemap: false },
    },
    ssr: {
      build: { sourcemap: false },
    },
  },
  plugins: [
    vinext({
      cache: responseStoreAdapter(),
      images: { optimizer: imagesOptimizer() },
    }),
    cloudflare({
      auxiliaryWorkers: [{ config: responseStoreServiceBinding }],
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
