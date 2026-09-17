import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "0.0.0.0",
    "**.localhost",
    "**.cursor.sh",
    "**.cursor.com",
    "**.cursorusercontent.com",
    "**.cloud.cursor.com",
  ],
  serverExternalPackages: ["xlsx"],
};

export default nextConfig;
