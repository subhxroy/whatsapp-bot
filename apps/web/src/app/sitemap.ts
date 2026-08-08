import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://caldera-whatsapp-bot.com';

  const routes = [
    '',
    '/login',
    '/dashboard',
    '/dashboard/whatsapp',
    '/dashboard/commands',
    '/dashboard/auto-reply',
    '/dashboard/ai',
    '/dashboard/media',
    '/dashboard/logs',
    '/dashboard/security',
    '/dashboard/settings',
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency: route === '' ? 'daily' : 'weekly',
    priority: route === '' ? 1.0 : 0.8,
  }));
}
