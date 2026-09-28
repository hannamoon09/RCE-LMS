import { test, expect, type Page } from '@playwright/test';
import { initialState, noticeData, tracks, type LMSState } from '../src/data/lmsData';

async function seed(page: Page, state: unknown) {
  await page.addInitScript(value => {
    sessionStorage.setItem('rce-lms-auth-v1', JSON.stringify({ userId: 'hanna' }));
    if (!localStorage.getItem('rce-lms-demo-v1')) localStorage.setItem('rce-lms-demo-v1', JSON.stringify(value));
  }, state);
}
for (const track of tracks) {
  test(`${track} account sees common assignments and only their own or shared notices`, async ({ page }) => {
    const state = structuredClone(initialState);
    state.users.find(user => user.id === 'hanna')!.track = track;
    await seed(page, state);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/assignments');
    for (const assignment of initialState.assignments) await expect(page.getByRole('heading', { name: assignment.title, exact: true })).toBeVisible();
    await expect(page.getByRole('combobox')).toHaveCount(0);
    await expect(page.getByRole('progressbar')).toHaveCount(0);
    await page.goto('/assignments/web-03/submit');
    await expect(page.getByRole('textbox', { name: '메모 및 질문 (선택)' })).toBeVisible();
    await page.goto('/notices');
    for (const notice of noticeData) {
      const heading = page.getByRole('heading', { name: notice.title, exact: true });
      if (notice.track === 'all' || notice.track === track) await expect(heading).toBeVisible();
      else await expect(heading).toHaveCount(0);
    }
    const forbiddenNotice = noticeData.find(notice => notice.track !== 'all' && notice.track !== track)!;
    await page.goto(`/notices/${forbiddenNotice.id}`);
    await expect(page.getByRole('heading', { name: '요청한 항목을 찾을 수 없습니다' })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('staff assigns one field per account and learner views update after refresh without losing submissions', async ({ page }) => {
  await seed(page, initialState);
  await page.goto('/admin/users');
  const field = page.getByRole('combobox', { name: 'Hanna 배정 분야' });
  await expect(field.locator('option')).toHaveText([...tracks]);
  await field.selectOption('포너블');
  await page.reload();
  await expect(field).toHaveValue('포너블');
  await page.goto('/assignments');
  await expect(page.getByRole('heading', { name: 'Stack Buffer Overflow', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'SQL Injection', exact: true })).toBeVisible();
  await page.goto('/settings');
  await expect(page.getByLabel('배정 분야', { exact: true })).toHaveValue('포너블');
  await expect(page.getByLabel('배정 분야', { exact: true })).toHaveAttribute('readonly', '');
  await page.goto('/admin/users');
  await field.selectOption('웹해킹');
  await page.goto('/assignments/web-02');
  await expect(page.getByText('xss-writeup.md', { exact: true })).toBeVisible();
});

test('member cannot reassign their field through admin routes', async ({ page }) => {
  const state = structuredClone(initialState);
  state.users.find(user => user.id === 'hanna')!.role = 'member';
  await seed(page, state);
  await page.goto('/dashboard');
  await expect(page.getByRole('navigation', { name: '주 메뉴', exact: true }).getByRole('link', { name: /운영진/ })).toHaveCount(0);
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { name: '운영진 전용 페이지입니다' })).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveCount(0);
});

test('version-one saved work migrates without trusting shared assignment progress or status', async ({ page }) => {
  const old = {
    ...structuredClone(initialState), version: 1,
    users: initialState.users.map(({ track: _track, ...user }) => ({ ...user, ...(user.id === 'hanna' ? { name: '저장된 이름' } : {}) })),
    assignments: initialState.assignments.map(assignment => ({ ...assignment, category: 'Web', course: '웹해킹 03주차', requirements: ['분석'], attachment: { name: 'auto.md', content: assignment.description }, status: 'submitted', progress: 100 })),
    preferences: { ...initialState.preferences, email: true },
  };
  await seed(page, old);
  await page.goto('/assignments/web-03');
  await expect(page.getByText('미제출', { exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('rce-lms-demo-v1')!)) as LMSState;
  expect(saved.version).toBe(3);
  expect(saved.users.find(user => user.id === 'hanna')?.name).toBe('저장된 이름');
  expect(saved.preferences.email).toBe(true);
  expect(saved.submissions).toEqual(old.submissions);
  expect(saved.assignments.every(assignment => !('progress' in assignment) && !('status' in assignment))).toBe(true);
  await page.goto('/assignments/web-02');
  await expect(page.getByText('xss-writeup.md', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('xss-writeup.md', { exact: true })).toBeVisible();
});

test('About and LMS navigate to distinct club and product sections with a branded hero', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('[data-security-network]')).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await page.getByRole('navigation', { name: '공개 페이지 메뉴' }).getByRole('link', { name: 'About', exact: true }).click();
  await expect(page).toHaveURL(/#about$/);
  await expect.poll(() => page.locator('#about').evaluate(element => Math.abs(element.getBoundingClientRect().top - 110) < 10)).toBe(true);
  const aboutScroll = await page.evaluate(() => scrollY);
  for (const track of tracks) await expect(page.locator('#about').getByText(track, { exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: '공개 페이지 메뉴' }).getByRole('link', { name: 'LMS', exact: true }).click();
  await expect(page).toHaveURL(/#lms$/);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(aboutScroll + 500);
  await expect(page.locator('#lms [data-product-preview]')).toBeVisible();
  await expect(page.locator('#lms').getByRole('progressbar')).toHaveCount(0);
});
