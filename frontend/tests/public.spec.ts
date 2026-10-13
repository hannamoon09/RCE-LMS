import { test, expect, type Page } from '@playwright/test';
import { loginAs } from './api-helpers';
import { createScenario } from './scenario';

const missingId = '00000000-0000-0000-0000-000000000000';
const protectedRoutes = [
  '/dashboard', '/assignments', `/assignments/${missingId}`, `/assignments/${missingId}/submit`,
  '/notices', `/notices/${missingId}`, '/submissions', '/rankings', '/profile', '/settings',
  '/admin', '/admin/assignments', '/admin/submissions', '/admin/users',
  '/dashboard/a', '/dashboard/b', '/dashboard/c', '/dashboard/d', '/prototypes',
];

function heroCTA(page: Page) {
  return page.locator('[data-hero-cta]').getByRole('link', { name: /^(로그인|대시보드로 이동)$/ });
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  // Anonymous restoration and the incorrect-password case intentionally return 401.
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('401 (Unauthorized)')) errors.push(message.text());
  });
  return errors;
}

async function signalState(page: Page) {
  return page.locator('[data-network-packet]').evaluateAll(elements => elements.map(element => {
    const style = getComputedStyle(element);
    return { transform: style.transform, opacity: style.opacity, position: element.getAttribute('cx') + ':' + element.getAttribute('cy') };
  }));
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 430, height: 932 }, { width: 375, height: 812 }]) {
  test(`public pages fit ${viewport.width}px and keep the hero CTA in the first viewport`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = collectErrors(page);
    await page.goto('/');
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Learn\.\s*Break\.\s*Defend\./);
    await expect(page.locator('[data-desktop-sidebar]')).toHaveCount(0);
    const cta = heroCTA(page);
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAccessibleName('로그인');
    const box = await cta.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
    const overview = page.getByLabel('RCE LMS 기능 안내', { exact: true });
    await overview.scrollIntoViewIfNeeded();
    await expect(overview.getByText('과제와 마감 확인', { exact: true })).toBeVisible();
    await expect(overview.getByText(/SQL Injection|XSS Write-up|RCE 2학기 활동 안내|피드백 도착/)).toHaveCount(0);
    await page.getByRole('contentinfo').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
    await cta.click();
    await expect(page).toHaveURL('/login');
    await expect(page.getByLabel('학번', { exact: true })).toBeVisible();
    await expect(page.getByLabel('비밀번호', { exact: true })).toBeVisible();
    if (viewport.width < 768) {
      const loginButton = await page.getByRole('button', { name: '로그인', exact: true }).boundingBox();
      expect(loginButton!.y + loginButton!.height).toBeLessThanOrEqual(viewport.height);
    }
    await expect(page.locator('[data-desktop-sidebar]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
    expect(errors).toEqual([]);
  });
}

test('authenticated visitors keep the public landing and can enter their dashboard', async ({ page, context, playwright }, testInfo) => {
  const scenario = await createScenario(playwright, testInfo.project.use.baseURL);
  try {
    await loginAs(context.request, scenario.member.studentId, scenario.member.password);
    await page.goto('/');
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Learn.');
    await expect(page.locator('[data-desktop-sidebar]')).toHaveCount(0);
    const cta = heroCTA(page);
    await expect(cta).toHaveAccessibleName('대시보드로 이동');
    await cta.click();
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(scenario.member.name);
  } finally { await scenario.dispose(); }
});

test('all LMS and unknown legacy routes require login', async ({ page }) => {
  for (const route of protectedRoutes) {
    await page.goto(route);
    await expect.poll(() => new URL(page.url()).pathname, { message: route }).toBe('/login');
    await expect(page.getByLabel('학번', { exact: true })).toBeVisible();
    await expect(page.locator('[data-desktop-sidebar]')).toHaveCount(0);
  }
});

test('login supports keyboard input, validation, loading, and returning to the requested route', async ({ page, playwright }, testInfo) => {
  const scenario = await createScenario(playwright, testInfo.project.use.baseURL);
  try {
  const errors = collectErrors(page);
  const destination = '/assignments?status=missing&q=SQL';
  await page.goto(destination);
  await expect.poll(() => new URL(page.url()).pathname).toBe('/login');
  await page.reload();
  const id = page.getByLabel('학번', { exact: true });
  const password = page.getByLabel('비밀번호', { exact: true });
  const submit = page.getByRole('button', { name: '로그인', exact: true });
  await expect(page.getByText(/회원가입|회원 가입|소셜 로그인|Google로|GitHub로|카카오로/)).toHaveCount(0);
  await expect(password).toHaveAttribute('type', 'password');
  await submit.click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/login');
  await expect(id).toBeFocused();
  await id.fill(scenario.member.studentId);
  await id.press('Tab');
  await expect(password).toBeFocused();
  await password.fill('incorrect-password');
  await submit.click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/login');
  await password.fill(scenario.member.password);
  let releaseLogin!: () => void;
  const waiting = new Promise<void>(resolve => { releaseLogin = resolve; });
  await page.route('**/api/auth/login', async route => { await waiting; await route.continue(); });
  await password.press('Enter');
  await expect(page.getByRole('button', { name: /로그인 중|확인 중|인증 중/ })).toBeDisabled();
  releaseLogin();
  await expect(page).toHaveURL(destination);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('과제');
  await page.reload();
  await expect(page).toHaveURL(destination);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('과제');
  expect((await (await page.request.get('/api/auth/me')).json()).id).toBe(scenario.member.id);
  expect(errors).toEqual([]);
  } finally { await scenario.dispose(); }
});

test('an invalid session cookie returns to the login form', async ({ page, context }, testInfo) => {
  await context.addCookies([{ name: 'JSESSIONID', value: 'invalid-session', url: testInfo.project.use.baseURL! }]);
  const errors = collectErrors(page);
  await page.goto('/dashboard');
  await expect.poll(() => new URL(page.url()).pathname).toBe('/login');
  await expect(page.getByLabel('학번', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('hero CTA works with a keyboard across repeated public navigation', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  for (let attempt = 0; attempt < 3; attempt++) {
    const cta = heroCTA(page);
    await expect(cta).toBeVisible();
    await cta.focus();
    await expect(cta).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('heading', { level: 1, name: '로그인' })).toBeFocused();
    await page.goBack();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Learn.');
  }
  await expect(heroCTA(page)).toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  expect(errors).toEqual([]);
});

test('ambient network motion can be paused and suspends outside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const pause = page.getByRole('button', { name: '배경 모션 일시 정지', exact: true });
  const network = page.locator('[data-security-network]');
  await expect(pause).toBeVisible();
  await expect(network).toHaveAttribute('data-network-state', 'running');
  await expect(page.locator('[data-network-packet]').first()).toBeAttached();
  const initial = await signalState(page);
  await expect.poll(() => signalState(page)).not.toEqual(initial);
  await pause.click();
  const resume = page.getByRole('button', { name: '배경 모션 재생', exact: true });
  await expect(resume).toBeVisible();
  await expect(network).toHaveAttribute('data-network-state', 'paused');
  const paused = await signalState(page);
  // Sample a later rendered frame to ensure pause stops the continuing signal animation.
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 250)));
  expect(await signalState(page)).toEqual(paused);
  await resume.click();
  await expect(pause).toBeVisible();
  await expect.poll(() => signalState(page)).not.toEqual(paused);
  await page.getByRole('contentinfo').scrollIntoViewIfNeeded();
  await expect(network).toHaveAttribute('data-network-state', 'offscreen');
  const offscreen = await signalState(page);
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 250)));
  expect(await signalState(page)).toEqual(offscreen);
  await network.scrollIntoViewIfNeeded();
  await expect(network).toHaveAttribute('data-network-state', 'running');
  await expect.poll(() => signalState(page)).not.toEqual(offscreen);
});

test('reduced motion keeps the story visible with no repeating signals', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Learn.');
  await expect(heroCTA(page)).toBeVisible();
  await expect(page.locator('[data-security-network]')).toHaveAttribute('data-network-state', 'reduced');
  const initial = await signalState(page);
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 250)));
  expect(await signalState(page)).toEqual(initial);
  const stages = page.locator('[data-workflow-stage]');
  await expect(stages).toHaveCount(4);
  for (const stage of await stages.all()) {
    await stage.scrollIntoViewIfNeeded();
    await expect(stage).toBeVisible();
    await expect(stage).toHaveCSS('opacity', '1');
  }
  await page.getByRole('contentinfo').scrollIntoViewIfNeeded();
  await expect(page.getByRole('contentinfo')).toBeVisible();
  const hiddenHeadings = await page.getByRole('heading').evaluateAll(headings => headings.filter(heading => getComputedStyle(heading).opacity === '0').length);
  expect(hiddenHeadings).toBe(0);
  await heroCTA(page).click();
  await expect(page).toHaveURL('/login');
  await expect(page.getByLabel('학번', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
