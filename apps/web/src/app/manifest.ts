import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Caldera — Private WhatsApp Automation Bot',
    short_name: 'Caldera Bot',
    description: 'Self-hosted private WhatsApp multi-device automation bot control dashboard with AES-256 encryption.',
    start_url: '/',
    display: 'standalone',
    background_color: '#e2e2df',
    theme_color: '#fc5000',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
