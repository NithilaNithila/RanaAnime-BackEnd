import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "watchanimeworld.org" },
      { protocol: "https", hostname: "*.watchanimeworld.org" },
      { protocol: "https", hostname: "watchanimeworld.top" },
      { protocol: "https", hostname: "*.watchanimeworld.top" },
      { protocol: "https", hostname: "watchanimeworld.cc" },
      { protocol: "https", hostname: "*.watchanimeworld.cc" },
      { protocol: "https", hostname: "watchanimeworld.net" },
      { protocol: "https", hostname: "*.watchanimeworld.net" },
      { protocol: "https", hostname: "watchanimeworld.com" },
      { protocol: "https", hostname: "*.watchanimeworld.com" },
    ],
  },
};

export default nextConfig;
