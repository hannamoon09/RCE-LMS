import { test, expect } from '@playwright/test';
import { createScenario } from './scenario';

test('[E2E beta] clean login rejects a wrong password and logout protects browser history', async ({ page, context, playwright, baseURL }) => {
  const scenario = await createScenario(playwright, baseURL, 'WEB');
  const runtimeErrors: string[] = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  try {
    expect(await context.cookies()).toEqual([]);
    await page.goto('/login');
    await expect(page.getByLabel('학번', { exact: true })).toBeEnabled();
    expect(await page.evaluate(async () => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage), databases: await indexedDB.databases() })))
      .toEqual({ local: [], session: [], databases: [] });
    await page.getByLabel('학번', { exact: true }).fill(scenario.member.studentId);
    await page.getByLabel('비밀번호', { exact: true }).fill('Wrong-password-for-beta!');
    const rejected = page.waitForResponse(response => response.url().endsWith('/api/auth/login'));
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    expect((await rejected).status()).toBe(401);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL('/login');
    expect((await context.request.get('/api/auth/me')).status()).toBe(401);
    expect((await context.cookies()).some(cookie => cookie.name === 'JSESSIONID')).toBe(false);

    await page.getByLabel('비밀번호', { exact: true }).fill(scenario.member.password);
    const accepted = page.waitForResponse(response => response.url().endsWith('/api/auth/login'));
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    const loggedIn = await accepted;
    expect(loggedIn.status()).toBe(200);
    expect(loggedIn.request().headers()['x-xsrf-token']).toBeTruthy();
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(scenario.member.name);
    const me = await context.request.get('/api/auth/me');
    expect(await me.json()).toMatchObject({ id: scenario.member.id, role: 'MEMBER', track: 'WEB', active: true });
    expect((await context.cookies()).find(cookie => cookie.name === 'JSESSIONID')).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
    await page.reload();
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(scenario.member.name);
    // Use SPA navigation so browser history contains a previously authenticated page.
    await page.locator('[data-desktop-sidebar]').getByRole('link', { name: '과제', exact: true }).click();
    await expect(page).toHaveURL('/assignments');
    const loggingOut = page.waitForResponse(response => response.url().endsWith('/api/auth/logout'));
    await page.getByRole('button', { name: '로그아웃', exact: true }).click();
    expect((await loggingOut).status()).toBe(204);
    await expect(page).toHaveURL('/login');
    await page.goBack();
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('로그인');
    for (const endpoint of ['/api/auth/me', '/api/assignments', '/api/submissions/me']) {
      expect((await context.request.get(endpoint)).status()).toBe(401);
    }
    expect(await page.evaluate(async () => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage), databases: await indexedDB.databases() })))
      .toEqual({ local: [], session: [], databases: [] });
    expect(runtimeErrors).toEqual([]);
  } finally { await scenario.dispose(); }
});
