import type { NextConfig } from "next";

// The Qloo edition runs on Vercel: the live flow uses this app's own API routes (Qloo + GLM), while the 27-day
// replay and the "about you" demo read files shipped in public/demo (NEXT_PUBLIC_API_URL=static), with no Python
// server. Set NEXT_PUBLIC_API_URL to the Python API's URL to use it instead.
const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "static",
    NEXT_PUBLIC_SIGN_IN: process.env.NEXT_PUBLIC_SIGN_IN ?? "off",
  },
};

export default nextConfig;
