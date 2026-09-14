import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@direct/shared", "@direct/core", "@direct/i18n"],
};

export default nextConfig;
