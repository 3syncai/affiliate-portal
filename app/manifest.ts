import type { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Oweg - Partners',
    short_name: 'Oweg Partners',
    description: 'Oweg partner portal for sales executives and hierarchy management.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#7AC943',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
