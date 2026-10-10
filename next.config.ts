import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* En Vercel no se usa output standalone (solo VPS/Docker).
     Para standalone local: usa `npm run build:standalone`. */
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
