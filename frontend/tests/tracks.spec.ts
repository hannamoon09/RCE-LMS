import { test, expect } from '@playwright/test';
import { tracks } from '../src/data/lmsData';
import { csrf, loginAs } from './api-helpers';
import { createScenario } from './scenario';

const fields = [ ['WEB', '웹해킹'], ['PWN', '포너블'], ['REVERSING', '리버싱'], ['FORENSICS', '포렌식'] ] as const;
for (const [track, label] of fields) {
  test(`${label} account sees only own assignments and own or global notices`, async ({ page, context, playwright }, testInfo) => {
    const own = await createScenario(playwright, testInfo.project.use.baseURL, track);
    const foreign = await createScenario(playwright, testInfo.project.use.baseURL, track === 'WEB' ? 'PWN' : 'WEB');
    try {
      const assignment = await own.createAssignment();
      const forbiddenAssignment = await foreign.createAssignment();
      const notice = await own.createNotice();
      const globalNotice = await own.createNotice({}, true);
      const forbiddenNotice = await foreign.createNotice();
      await loginAs(context.request, own.member.studentId, own.member.password);
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto('/assignments?track=forged');
      await expect(page.getByRole('heading', { name: assignment.title, exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: forbiddenAssignment.title, exact: true })).toHaveCount(0);
      await expect(page.getByRole('combobox')).toHaveCount(0);
      await expect(page.getByRole('progressbar')).toHaveCount(0);
      await page.goto(`/assignments/${assignment.id}/submit`);
      await expect(page.getByRole('textbox', { name: '메모 및 질문 (선택)' })).toBeVisible();
      expect((await context.request.get(`/api/assignments/${forbiddenAssignment.id}`)).status()).toBe(404);
      await page.goto(`/assignments/${forbiddenAssignment.id}`);
      await expect(page.getByRole('heading', { name: '요청한 항목을 찾을 수 없습니다' })).toBeVisible();
      await page.goto('/notices');
      for (const allowed of [notice, globalNotice]) await expect(page.getByRole('heading', { name: allowed.title, exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: forbiddenNotice.title, exact: true })).toHaveCount(0);
      await page.goto(`/notices/${forbiddenNotice.id}`);
      await expect(page.getByRole('heading', { name: '요청한 항목을 찾을 수 없습니다' })).toBeVisible();
      expect(errors).toEqual([]);
    } finally { await foreign.dispose(); await own.dispose(); }
  });
}

test('staff manages own-field members without reassignment or promotion controls and submissions remain attached to the member', async ({ page, context, playwright }, testInfo) => {
  const scenario = await createScenario(playwright, testInfo.project.use.baseURL);
  try {
    const assignment = await scenario.createAssignment();
    const saved = await scenario.memberRequest.post(`/api/assignments/${assignment.id}/submission`, { headers: await csrf(scenario.memberRequest), data: { content: '보존할 실습 기록' } });
    expect(saved.status()).toBe(200); const submission = await saved.json();
    await loginAs(context.request, scenario.staff.studentId, scenario.staff.password);
    await page.goto('/admin/users');
    await page.getByRole('searchbox', { name: '학생 검색', exact: true }).fill(scenario.member.studentId);
    await page.getByRole('button', { name: `${scenario.member.name} 수정`, exact: true }).click();
    const editor = page.getByRole('dialog', { name: '학생 계정 수정', exact: true });
    await expect(editor.getByRole('combobox')).toHaveCount(0);
    await expect(editor.getByLabel('학번', { exact: true })).toHaveAttribute('readonly', '');
    for (const patch of [{ track: 'WEB' }, { role: 'STAFF' }]) expect((await scenario.staffRequest.patch(`/api/admin/users/${scenario.member.id}`, { headers: await csrf(scenario.staffRequest), data: patch })).status()).toBe(400);
    await loginAs(context.request, scenario.member.studentId, scenario.member.password);
    await page.goto('/settings');
    await expect(page.getByLabel('배정 분야', { exact: true })).toHaveValue('포너블');
    await expect(page.getByLabel('배정 분야', { exact: true })).toHaveAttribute('readonly', '');
    await page.goto(`/assignments/${assignment.id}`);
    await expect(page.getByText('보존할 실습 기록', { exact: true })).toBeVisible();
    expect((await (await context.request.get(`/api/assignments/${assignment.id}/submission`)).json()).id).toBe(submission.id);
  } finally { await scenario.dispose(); }
});

test('member cannot reassign their field through admin routes', async ({ page, context, playwright }, testInfo) => {
  const scenario = await createScenario(playwright, testInfo.project.use.baseURL);
  try {
    await loginAs(context.request, scenario.member.studentId, scenario.member.password);
    await page.goto('/dashboard');
    await expect(page.getByRole('navigation', { name: '주 메뉴', exact: true }).getByRole('link', { name: /운영진/ })).toHaveCount(0);
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: '운영진 전용 페이지입니다' })).toBeVisible();
    await expect(page.getByRole('combobox')).toHaveCount(0);
    expect((await context.request.patch(`/api/admin/users/${scenario.member.id}`, { headers: await csrf(context.request), data: { track: 'WEB' } })).status()).toBe(403);
  } finally { await scenario.dispose(); }
});

test('old browser state cannot override server identity, assignment status or preferences', async ({ page, context, playwright }, testInfo) => {
  const scenario = await createScenario(playwright, testInfo.project.use.baseURL);
  try {
    const assignment = await scenario.createAssignment();
    await loginAs(context.request, scenario.member.studentId, scenario.member.password);
    await page.addInitScript(({ id }) => {
      sessionStorage.setItem('rce-lms-auth-v1', JSON.stringify({ userId: 'hanna' }));
      localStorage.setItem('rce-lms-demo-v1', JSON.stringify({ version: 1, users: [{ id: 'hanna', name: '조작한 이름', role: 'staff', track: '웹해킹' }], assignments: [{ id, status: 'submitted', progress: 100 }], preferences: { assignment: false, notice: false, feedback: false, email: true } }));
    }, { id: assignment.id });
    await page.goto(`/assignments/${assignment.id}`);
    await expect(page.getByText('미제출', { exact: true })).toBeVisible();
    await expect(page.getByRole('progressbar')).toHaveCount(0);
    await expect(page.locator('[data-desktop-sidebar]')).toContainText(scenario.member.name);
    await expect(page.locator('[data-desktop-sidebar]')).not.toContainText('조작한 이름');
    await page.goto('/settings');
    await expect(page.getByRole('switch', { name: '과제 알림', exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('switch', { name: '이메일 수신', exact: true })).toHaveAttribute('aria-checked', 'false');
    await page.reload();
    await expect(page.getByLabel('이름', { exact: true })).toHaveValue(scenario.member.name);
  } finally { await scenario.dispose(); }
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
