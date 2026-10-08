import type { MetadataRoute } from 'next'
import { BARBEARIA as B } from '@/config/barbearia'

// Torna o site instalável no celular (PWA). Nome e cores vêm do arquivo de configuração.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: B.nome,
    short_name: B.nome.slice(0, 12),
    start_url: '/',
    display: 'standalone',
    background_color: B.cores.fundo,
    theme_color: B.cores.fundo,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
