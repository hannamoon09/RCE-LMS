import { test, expect, type Page } from '@playwright/test';
import { csrf, loginAs } from './api-helpers';
import { createScenario, type Scenario } from './scenario';

let scenario: Scenario;
let openAssignment: Awaited<ReturnType<Scenario['createAssignment']>>;
let submittedAssignment: Awaited<ReturnType<Scenario['createAssignment']>>;
let closedAssignment: Awaited<ReturnType<Scenario['createAssignment']>>;
let submissionId: string;
let noticeId: string;
let memberRoutes: string[];
const staffRoutes = ['/admin', '/admin/assignments', '/admin/submissions', '/admin/users'];

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  return errors;
}

test.beforeEach(async ({ context, playwright }, testInfo) => {
  scenario = await createScenario(playwright, testInfo.project.use.baseURL);
  openAssignment = await scenario.createAssignment({ title: 'SQL Injection' });
  submittedAssignment = await scenario.createAssignment({ title: 'XSS Write-up' });
  closedAssignment = await scenario.createAssignment({ title: 'Closed Evidence Lab' });
  const closed = await scenario.staffRequest.patch(`/api/admin/assignments/${closedAssignment.id}`, {
    headers: await csrf(scenario.staffRequest),
    data: { title: closedAssignment.title, description: closedAssignment.description, difficulty: closedAssignment.difficulty, deadline: new Date(Date.now() - 86400000).toISOString() },
  });
  expect(closed.status()).toBe(200);
  const submission = await scenario.memberRequest.post(`/api/assignments/${submittedAssignment.id}/submission`, {
    headers: await csrf(scenario.memberRequest), data: { content: '실제 서버에 저장한 회귀 검증 제출입니다.' },
  });
  expect(submission.status()).toBe(200);
  submissionId = (await submission.json()).id;
  const notice = await scenario.createNotice({ title: 'Important Lab Notice', important: true });
  noticeId = notice.id;
  await scenario.createNotice({ title: 'Ordinary Lab Notice' });
  await loginAs(context.request, scenario.member.studentId, scenario.member.password);
  memberRoutes = ['/dashboard', '/assignments', `/assignments/${openAssignment.id}`, `/assignments/${openAssignment.id}/submit`,
    '/notices', `/notices/${noticeId}`, '/submissions', '/rankings', '/profile', '/settings'];
});
test.afterEach(async () => { await scenario?.dispose(); });

for (const width of [1440, 1280, 1024, 768, 390, 375]) {
  test(`all routes render without overflow or console errors at ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = collectErrors(page);
    const verifyRoutes = async (routes: string[]) => {
      for (const route of routes) {
        await page.goto(route);
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.getByText(/화면을 불러오지 못했습니다|운영진 전용 페이지입니다|학습자만 제출할 수 있습니다/)).toHaveCount(0);
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), { message: route }).toBe(true);
        if (width < 768 && ['/submissions', '/rankings', '/admin/assignments', '/admin/submissions', '/admin/users'].includes(route)) {
          await expect(page.locator('table')).toBeHidden();
        }
      }
    };
    await verifyRoutes(memberRoutes);
    for (const route of ['/prototypes', '/dashboard/a', '/dashboard/b', '/dashboard/c', '/dashboard/d']) {
      await page.goto(route);
      await expect(page.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Dashboard designs' })).toHaveCount(0);
      await expect(page.getByRole('region', { name: 'Design options' })).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    await loginAs(context.request, scenario.staff.studentId, scenario.staff.password);
    await verifyRoutes(staffRoutes);
    expect(errors).toEqual([]);
  });
}

test('search and combined filters expose a useful empty state', async ({ page }) => {
  await page.goto('/assignments');
  await page.getByRole('searchbox', { name: '과제 검색' }).fill('SQL');
  await expect(page.getByRole('heading', { name: openAssignment.title })).toBeVisible();
  await page.getByRole('button', { name: '제출 완료', exact: true }).click();
  await expect(page.getByRole('heading', { name: '조건에 맞는 과제가 없습니다' })).toBeVisible();
  await page.getByRole('button', { name: '필터 초기화' }).click();
  await page.getByRole('button', { name: '제출 완료', exact: true }).click();
  await expect(page.getByRole('heading', { name: submittedAssignment.title })).toBeVisible();
  await expect(page.getByRole('heading', { name: openAssignment.title })).toHaveCount(0);
  await expect(page.getByLabel('트랙 필터')).toHaveCount(0);
  await page.goto('/notices');
  await page.getByRole('button', { name: '중요 공지', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Important Lab Notice', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ordinary Lab Notice', exact: true })).toHaveCount(0);
});

test('an explicitly reviewed zero remains visible after reload in the learner detail', async ({ page, context }) => {
  await loginAs(context.request, scenario.staff.studentId, scenario.staff.password);
  await page.goto(`/admin/submissions?submission=${submissionId}`);
  const dialog = page.getByRole('dialog', { name: `${scenario.member.name} · 제출 검토`, exact: true });
  await dialog.getByLabel('점수 / 100', { exact: true }).fill('0');
  await dialog.getByLabel('피드백', { exact: true }).fill('재현 과정의 근거를 보완해 주세요.');
  await dialog.getByRole('button', { name: '검토 저장', exact: true }).click();
  await expect(dialog).toBeHidden();
  await loginAs(context.request, scenario.member.studentId, scenario.member.password);
  await page.goto(`/assignments/${submittedAssignment.id}`);
  await expect(page.getByText('0 / 100', { exact: true })).toBeVisible();
  await expect(page.getByText('재현 과정의 근거를 보완해 주세요.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('0 / 100', { exact: true })).toBeVisible();
});

// Submission persistence, assignment CRUD, account/password and preferences mutations
// are covered by the corresponding real-API feature suites.

test('mobile drawer closes after motion, traps focus and supports reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  const trigger = page.getByRole('button', { name: '메뉴 열기' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '메뉴', exact: true });
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole('button', { name: '메뉴 닫기', exact: true });
  const logout = dialog.getByRole('button', { name: '로그아웃', exact: true });
  await expect(close).toBeFocused();
  const tabStops = await dialog.locator('button:not([tabindex="-1"]), a[href]').count();
  for (const key of ['Tab', 'Shift+Tab']) {
    await close.focus();
    for (let index = 0; index < tabStops + 2; index++) {
      await page.keyboard.press(key);
      expect(await dialog.evaluate(element => element.contains(document.activeElement)), `${key} step ${index + 1}`).toBe(true);
    }
  }
  await logout.focus();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(logout).toBeFocused();
  await page.setViewportSize({ width: 390, height: 480 });
  await logout.scrollIntoViewIfNeeded();
  await expect(logout).toBeInViewport();
  const panel = dialog.locator(':scope > div');
  await expect(panel).toHaveCSS('overflow-y', 'auto');
  expect(await panel.evaluate(element => element.getBoundingClientRect().bottom <= innerHeight + 1)).toBe(true);
  await close.click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await trigger.click();
  await dialog.getByRole('link', { name: '과제', exact: true }).click();
  await expect(page).toHaveURL('/assignments');
  await expect(dialog).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await trigger.click();
  await dialog.getByRole('button', { name: '메뉴 닫기' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});


test('reduced motion keeps every route visible and server-derived counters final', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const verify = async (routes: string[]) => {
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      const hidden = await page.locator('[data-reveal], .motion-panel').evaluateAll(elements => elements.filter(element => getComputedStyle(element).opacity === '0').length);
      expect(hidden, route).toBe(0);
    }
  };
  await verify(memberRoutes);
  await page.goto('/dashboard');
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await expect(page.locator('[data-summary="total"]')).toContainText('3');
  await expect(page.locator('[data-summary="submitted"]')).toContainText('1');
  await expect(page.locator('[data-summary="missing"]')).toContainText('2');
  await loginAs(context.request, scenario.staff.studentId, scenario.staff.password);
  await verify(staffRoutes);
});

test('file validation, removal, drag-drop and closed submission controls remain usable', async ({ page }) => {
  await page.goto(`/assignments/${openAssignment.id}/submit`);
  await page.getByRole('button', { name: '제출하기', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('파일');
  const input = page.getByLabel('제출 파일 선택');
  await input.setInputFiles({ name: 'bad.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('bad') });
  await expect(page.getByRole('alert')).toContainText('지원하지 않는 형식');
  await input.setInputFiles({ name: 'big.zip', mimeType: 'application/zip', buffer: Buffer.alloc(11 * 1024 * 1024) });
  await expect(page.getByRole('alert')).toContainText('10MB를 초과');
  const data = await page.evaluateHandle(() => { const transfer = new DataTransfer(); transfer.items.add(new File(['hello'], 'drop.md', { type: 'text/markdown' })); return transfer; });
  const dropzone = page.getByRole('button', { name: /파일을 드래그하거나 클릭하여 선택/ });
  await dropzone.dispatchEvent('dragenter', { dataTransfer: data });
  await dropzone.dispatchEvent('drop', { dataTransfer: data });
  await expect(page.getByText('drop.md', { exact: true })).toBeVisible();
  await input.setInputFiles({ name: 'drop.md', mimeType: 'text/markdown', buffer: Buffer.from('duplicate') });
  await expect(page.getByRole('alert')).toContainText('이미 추가된 파일');
  await page.getByRole('button', { name: 'drop.md 제거' }).click();
  await expect(page.getByText('drop.md', { exact: true })).toHaveCount(0);
  await data.dispose();
  await page.goto(`/assignments/${closedAssignment.id}/submit`);
  await expect(page.getByRole('button', { name: '제출 마감', exact: true })).toBeDisabled();
  await expect(page.getByRole('textbox', { name: '메모 및 질문 (선택)' })).toBeDisabled();
});

test('admin status and selected-review query state survive refresh and dismissal', async ({ page, context }) => {
  await loginAs(context.request, scenario.staff.studentId, scenario.staff.password);
  await page.goto('/admin/submissions?status=pending');
  await page.getByRole('button', { name: '검토 완료', exact: true }).click();
  await expect(page).toHaveURL(/status=reviewed/);
  await page.reload();
  await expect(page.getByRole('button', { name: '검토 완료', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.goto(`/admin/submissions?submission=${submissionId}`);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: `${scenario.member.name} · 제출 검토 닫기`, exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).not.toHaveURL(/submission=/);
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
