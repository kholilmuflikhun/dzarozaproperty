import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  transpilePackages: ["@dzaroza/database", "@dzaroza/shared"],
  serverExternalPackages: ["@prisma/client"],
  poweredByHeader: false,
};
export default nextConfig;
