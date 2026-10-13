import { test, expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';

const seedPassword = process.env.DEV_SEED_PASSWORD;
if (!seedPassword) throw new Error('DEV_SEED_PASSWORD must match the running backend development seed.');

const staffId = '20260000';
const memberId = '20260001';

async function resolvedCsrf(request: APIRequestContext) {
  const response = await request.get('/api/csrf');
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('no-store');
  const body = await response.json();
  expect(body.token).toEqual(expect.any(String));
  expect(body.token.length).toBeGreaterThan(0);
  const cookie = (await request.storageState()).cookies.find(item => item.name === 'XSRF-TOKEN');
  expect(cookie, 'Resolving /api/csrf must issue the SPA CSRF cookie.').toBeDefined();
  expect(cookie!.httpOnly).toBe(false);
  expect(cookie!.path).toBe('/');
  return decodeURIComponent(cookie!.value);
}

async function loginThroughApi(request: APIRequestContext, studentId = memberId) {
  const token = await resolvedCsrf(request);
  const response = await request.post('/api/auth/login', {
    headers: { 'X-XSRF-TOKEN': token },
    data: { studentId, password: seedPassword },
  });
  expect(response.status()).toBe(200);
  return token;
}

async function fillLogin(page: Page, studentId: string, password = seedPassword!) {
  const student = page.getByLabel('학번', { exact: true });
  await expect(student).toBeEnabled();
  await student.fill(studentId);
  await page.getByLabel('비밀번호', { exact: true }).fill(password);
}

async function sessionCookie(context: BrowserContext) {
  const cookie = (await context.cookies()).find(item => item.name === 'JSESSIONID');
  expect(cookie, 'Successful login must persist an HTTP session cookie.').toBeDefined();
  expect(cookie!.httpOnly).toBe(true);
  expect(cookie!.sameSite).toBe('Lax');
  expect(cookie!.path).toBe('/');
  return cookie!;
}

test('raw CSRF cookie token authenticates, rotates, persists a session, and logs out', async ({ request }) => {
  const anonymous = await request.get('/api/auth/me');
  expect(anonymous.status()).toBe(401);

  const loginToken = await loginThroughApi(request);
  const refreshedToken = await resolvedCsrf(request);
  expect(refreshedToken).not.toBe(loginToken);
  const me = await request.get('/api/auth/me');
  expect(me.status()).toBe(200);
  expect(me.headers()['cache-control']).toContain('no-store');
  expect(await me.json()).toMatchObject({ studentId: memberId, active: true });
  const session = (await request.storageState()).cookies.find(cookie => cookie.name === 'JSESSIONID');
  expect(session?.httpOnly).toBe(true);

  const blockedLogout = await request.post('/api/auth/logout');
  expect(blockedLogout.status()).toBe(403);
  expect((await request.get('/api/auth/me')).status()).toBe(200);
  const logout = await request.post('/api/auth/logout', { headers: { 'X-XSRF-TOKEN': refreshedToken } });
  expect([200, 204]).toContain(logout.status());
  expect((await request.get('/api/auth/me')).status()).toBe(401);
  expect(await resolvedCsrf(request)).not.toBe(refreshedToken);
});

test('login without a CSRF header is blocked and an incorrect password never starts a session', async ({ request }) => {
  const token = await resolvedCsrf(request);
  const noCsrf = await request.post('/api/auth/login', { data: { studentId: memberId, password: seedPassword } });
  expect(noCsrf.status()).toBe(403);
  const wrongPassword = await request.post('/api/auth/login', {
    headers: { 'X-XSRF-TOKEN': token },
    data: { studentId: memberId, password: 'wrong-password-for-api-test' },
  });
  expect(wrongPassword.status()).toBe(401);
  expect(await wrongPassword.json()).toMatchObject({ code: expect.any(String), message: expect.any(String) });
  expect((await request.get('/api/auth/me')).status()).toBe(401);
});

for (const [label, studentId] of [['member', memberId], ['staff', staffId]] as const) {
  test(`${label} uses the existing login form and restores the dashboard session after reload`, async ({ page, context }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/login');
    await fillLogin(page, studentId);
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await expect(page).toHaveURL('/dashboard');
    const me = await context.request.get('/api/auth/me');
    expect(me.status()).toBe(200);
    const user = await me.json();
    expect(user.studentId).toBe(studentId);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(user.name);
    await expect(page.locator('[data-desktop-sidebar]')).toBeVisible();
    await sessionCookie(context);
    expect(await page.evaluate(() => sessionStorage.getItem('rce-lms-auth-v1'))).toBeNull();

    await page.reload();
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(user.name);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${label}-dashboard.png`), fullPage: true });
    expect(errors).toEqual([]);

    await page.getByRole('button', { name: '로그아웃', exact: true }).click();
    await expect.poll(async () => (await context.request.get('/api/auth/me')).status()).toBe(401);
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
    await expect(page.getByLabel('학번', { exact: true })).toBeEnabled();
  });
}

test('protected route retains its destination through login and reload', async ({ page }) => {
  const destination = '/assignments?status=missing&q=SQL';
  await page.goto(destination);
  await expect(page).toHaveURL('/login');
  await page.reload();
  await fillLogin(page, memberId);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL(destination);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('과제');
  await page.reload();
  await expect(page).toHaveURL(destination);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('과제');
});

test('an external return destination falls back to the local dashboard', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('학번', { exact: true })).toBeEnabled();
  await page.evaluate(() => {
    history.replaceState({ ...history.state, usr: { from: 'https://example.invalid/external' } }, '', '/login');
  });
  await page.reload();
  await fillLogin(page, memberId);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL('/dashboard');
});

test('the existing mobile login and dashboard remain usable with server authentication', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/login');
  await fillLogin(page, memberId);
  await page.screenshot({ path: testInfo.outputPath('mobile-login.png'), fullPage: true });
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('mobile-dashboard.png'), fullPage: true });
});
