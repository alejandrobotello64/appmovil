import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "**.cursor.sh",
    "**.cursor.com",
    "**.cursorusercontent.com",
  ],
  serverExternalPackages: ["xlsx"],
};

export default nextConfig;
