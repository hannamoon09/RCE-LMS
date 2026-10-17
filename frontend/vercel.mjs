import { routes } from '@vercel/config/v1';

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
  // Keep dynamic values in SDK calls, as in Vercel's API proxy template.
  rewrites: [
    routes.rewrite('/api', `${backend.origin}/api`),
    routes.rewrite('/api/(.*)', `${backend.origin}/api/$1`),
    routes.rewrite('/(.*)', '/index.html'),
  ],
  headers: [
    routes.header('/api', noStoreHeaders),
    routes.header('/api/(.*)', noStoreHeaders),
  ],
};
