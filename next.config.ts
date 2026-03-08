import type { NextConfig } from "next";
// Force restart

// @ts-check
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.r2.dev',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  serverExternalPackages: [
    'isomorphic-dompurify',
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  async headers() {
    return [
      // Security headers for all routes
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-eval' 'unsafe-inline' https://challenges.cloudflare.com https://apis.google.com https://js.stripe.com https://m.stripe.network https://m.stripe.com https://*.line-scdn.net https://*.line.me;
              style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
              img-src 'self' blob: data: https://placehold.co https://images.unsplash.com https://picsum.photos https://*.r2.dev https://i.pravatar.cc https://*.googleusercontent.com https://*.stripe.com https://*.line-scdn.net https://*.line.me;
              font-src 'self' https://fonts.gstatic.com;
              connect-src 'self' https://challenges.cloudflare.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebasestorage.googleapis.com https://firestore.googleapis.com https://*.firebaseapp.com https://api.stripe.com https://m.stripe.com https://m.stripe.network https://*.line.me https://*.line-scdn.net;
              frame-src 'self' https://challenges.cloudflare.com https://*.firebaseapp.com https://*.googleapis.com https://auth.lawslane.com https://js.stripe.com https://hooks.stripe.com https://b.stripe.com https://*.line.me https://*.line-scdn.net;
            `.replace(/\s{2,}/g, ' ').trim(),
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'unsafe-none',
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
