import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { csrf, loginAs } from './api-helpers';

test('development server blocks private storage and backend files while authenticated downloads remain available', async ({ request, playwright }, testInfo) => {
  const marker = `private-test-${randomUUID()}`;
  const relative = `backend-data/e2e-uploads/${randomUUID()}.txt`;
  const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
  const absolute = path.join(repositoryRoot, relative);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, marker);
  const anonymous = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
  try {
    for (const file of [absolute, path.join(repositoryRoot, 'backend/src/main/resources/application.yaml'), path.join(repositoryRoot, '.env')]) {
      const url = `/@fs${file}`;
      const response = await anonymous.get(url);
      expect(response.status(), url).toBe(403);
      expect(await response.text()).not.toContain(marker);
    }
    expect((await anonymous.get(`/api/files/${randomUUID()}`)).status()).toBe(401);
    await loginAs(request);
    expect((await request.get('/api/me')).headers()['cache-control']).toBe('no-store');
    expect((await request.get('/api/me/preferences')).headers()['cache-control']).toBe('no-store');
    const token = await csrf(request);
    const response = await request.patch('/api/me/preferences', { headers: token, data: { assignment: true, notice: true, feedback: true, email: false } });
    expect(response.status()).toBe(200);
  } finally { await anonymous.dispose(); await rm(absolute, { force: true }); }
});
