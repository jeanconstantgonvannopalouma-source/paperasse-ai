import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Configuration Turbopack (vide mais nécessaire)
  turbopack: {},
  
  // Configuration expérimentale (optionnelle mais propre)
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

export default nextConfig