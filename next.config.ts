import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@google-cloud/firestore", "google-auth-library"],
};

export default nextConfig;
