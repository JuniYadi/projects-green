/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: '.',
  },
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  experimental: {
    preloadEntriesOnStart: false,
    webpackMemoryOptimizations: true,
  }
}

export default nextConfig
