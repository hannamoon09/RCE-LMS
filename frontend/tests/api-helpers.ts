import { expect, type APIRequestContext } from '@playwright/test';

export const staffStudentId = '20260000';
export const memberStudentId = '20260001';

export function seedPassword(): string {
  const password = process.env.DEV_SEED_PASSWORD;
  if (!password) throw new Error('Source the ignored development .env before running API browser tests.');
  return password;
}

export async function csrf(request: APIRequestContext): Promise<Record<string, string>> {
  const response = await request.get('/api/csrf');
  expect(response.status()).toBe(200);
  const cookie = (await request.storageState()).cookies.find(item => item.name === 'XSRF-TOKEN');
  expect(cookie).toBeDefined();
  return { 'X-XSRF-TOKEN': decodeURIComponent(cookie!.value) };
}

export async function loginAs(request: APIRequestContext, studentId = memberStudentId, password = seedPassword()) {
  const response = await request.post('/api/auth/login', {
    headers: await csrf(request), data: { studentId, password },
  });
  expect(response.status()).toBe(200);
  await csrf(request);
  const me = await request.get('/api/auth/me');
  expect(me.status()).toBe(200);
  return me.json();
}

/** Unique readable fixture names keep browser tests independent of old demo IDs. */
export function fixtureName(label: string) {
  return `${label}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}
