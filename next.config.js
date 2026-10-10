/** @type {import('next').NextConfig} */
const seguranca = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
]

module.exports = {
  reactStrictMode: true,
  poweredByHeader: false, // remove X-Powered-By
  experimental: {
    // O preview local usa threads neste Windows para contornar a restrição de processos.
    // Build e produção preservam o comportamento padrão do Next.
    ...(process.env.NEXT_USE_WORKER_THREADS === '1' ? { workerThreads: true } : {}),
    ...(process.env.NEXT_DISABLE_WEBPACK_BUILD_WORKER === '1' ? { webpackBuildWorker: false } : {}),
  },
  async headers() {
    // A Content-Security-Policy (com nonce) é definida em src/middleware.ts
    return [
      { source: '/(.*)', headers: seguranca },
      { source: '/api/(.*)', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
      { source: '/verificar-email', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
      { source: '/redefinir-senha', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ]
  },
}
