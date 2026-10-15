const value = process.env.BACKEND_ORIGIN?.trim();
const configurationError = 'BACKEND_ORIGIN must be an HTTPS origin without credentials, a path, a query, or a fragment.';

if (!value) throw new Error('Set BACKEND_ORIGIN to the Railway backend HTTPS origin before deploying.');

let backend;
try {
  backend = new URL(value);
} catch {
  throw new Error(configurationError);
}

if (
  !/^https:\/\/[^/?#\\\s@]+\/?$/.test(value)
  || backend.protocol !== 'https:'
  || backend.username
  || backend.password
  || backend.pathname !== '/'
  || backend.search
  || backend.hash
) {
  throw new Error(configurationError);
}

const noStoreHeaders = [
  { key: 'Cache-Control', value: 'no-store' },
  { key: 'CDN-Cache-Control', value: 'no-store' },
  { key: 'Vercel-CDN-Cache-Control', value: 'no-store' },
];

export const config = {
  framework: 'vite',
  installCommand: 'npm ci',
  buildCommand: 'npm run build',
  outputDirectory: 'dist',
  rewrites: [
    { source: '/api', destination: `${backend.origin}/api` },
    { source: '/api/(.*)', destination: `${backend.origin}/api/$1` },
    { source: '/(.*)', destination: '/index.html' },
  ],
  headers: [
    { source: '/api', headers: noStoreHeaders },
    { source: '/api/(.*)', headers: noStoreHeaders },
  ],
};
