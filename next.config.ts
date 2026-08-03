import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    qualities: [75],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "sleepercdn.com",
        port: "",
        pathname: "/content/nfl/players/**",
        search: "",
      },
    ],
  },
};

export default nextConfig;
