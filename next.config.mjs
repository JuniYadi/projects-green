/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "pino",
    "pino-pretty",
    "ssh2",
    "@react-pdf/renderer",
    "pdfkit",
  ],
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: process.cwd(),
  },
  allowedDevOrigins: ["127.0.0.1", "localhost", "pgreen.tunnel.juniyadi.id"],
  experimental: {
    preloadEntriesOnStart: false,
    webpackMemoryOptimizations: true,
  },
}

export default nextConfig
