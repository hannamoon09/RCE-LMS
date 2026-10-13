import { test, expect, type Page } from '@playwright/test';
import { createScenario } from './scenario';
import { fixtureName, loginAs } from './api-helpers';

async function expectNoBrowserDatabase(page: Page) {
  expect(await page.evaluate(async () => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    databases: (await indexedDB.databases()).map(database => database.name),
  }))).toEqual({ local: [], session: [], databases: [] });
}

async function loginInBrowser(page: Page, account: { studentId: string; password: string }) {
  await page.goto('/login');
  await expect(page.getByLabel('학번', { exact: true })).toBeEnabled();
  await expectNoBrowserDatabase(page);
  await page.getByLabel('학번', { exact: true }).fill(account.studentId);
  await page.getByLabel('비밀번호', { exact: true }).fill(account.password);
  const loggingIn = page.waitForResponse(response => response.url().endsWith('/api/auth/login'));
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  const response = await loggingIn;
  expect(response.status()).toBe(200);
  expect(response.request().headers()['x-xsrf-token']).toBeTruthy();
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('h1')).toBeVisible();
}

test('clean browsers use persisted API data through empty state, submission, review, reload and logout', async ({ browser, playwright, baseURL }, testInfo) => {
  test.setTimeout(90_000);
  const scenario = await createScenario(playwright, baseURL);
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext({ baseURL, viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })));
  const [memberContext, staffContext, otherContext] = contexts;
  const errors: string[] = [];
  try {
    for (const context of contexts) expect(await context.cookies()).toEqual([]);
    const member = await memberContext.newPage();
    const staff = await staffContext.newPage();
    const other = await otherContext.newPage();
    for (const page of [member, staff, other]) page.on('pageerror', error => errors.push(error.message));
    await loginInBrowser(member, scenario.member);
    for (const endpoint of ['/api/assignments', '/api/notices', '/api/submissions/me']) {
      const response = await memberContext.request.get(endpoint);
      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual([]);
    }
    await expect(member.locator('[data-summary="total"]')).toContainText('0');
    await expect(member.locator('[data-ranking-total]')).toHaveText('0');
    await expect(member.getByText('활동 기록이 없습니다.', { exact: true })).toBeVisible();
    await member.screenshot({ path: testInfo.outputPath('clean-empty-dashboard.png'), fullPage: true });
    for (const [route, text] of [
      ['/assignments', '등록된 과제가 없습니다'],
      ['/notices', '아직 공지가 없습니다'],
      ['/submissions', '아직 제출한 과제가 없습니다'],
      ['/rankings', '아직 채점된 과제가 없습니다.'],
    ]) {
      await member.goto(route);
      await expect(member.getByText(text, { exact: true })).toBeVisible();
      await expect(member.getByRole('alert')).toHaveCount(0);
    }
    await loginInBrowser(staff, scenario.staff);
    await staff.goto('/admin/assignments?create=1');
    const editor = staff.getByRole('dialog', { name: '새 과제 생성', exact: true });
    const title = fixtureName('운영 전환 실습');
    await editor.getByLabel('과제명', { exact: true }).fill(title);
    await editor.getByLabel('과제 설명', { exact: true }).fill('실제 서버에 기록하는 제출과 검토입니다.');
    const creating = staff.waitForResponse(response => response.url().endsWith('/api/admin/assignments') && response.request().method() === 'POST');
    await editor.getByRole('button', { name: '과제 생성', exact: true }).click();
    const created = await creating;
    expect(created.status()).toBe(201);
    const assignment = await created.json();
    await expect(editor).toBeHidden();
    const notice = await scenario.createNotice({ title: fixtureName('운영 전환 공지') });

    await member.goto(`/assignments/${assignment.id}`);
    await expect(member.getByRole('heading', { level: 1 })).toHaveText(title);
    await member.getByRole('link', { name: '과제 제출하기', exact: true }).click();
    await member.getByLabel('메모 및 질문 (선택)', { exact: true }).fill('브라우저 저장소 없이 서버에 제출한 분석 내용');
    await member.getByRole('button', { name: '제출하기', exact: true }).click();
    const posting = member.waitForResponse(response => response.url().endsWith(`/api/assignments/${assignment.id}/submission`) && response.request().method() === 'POST');
    await member.getByRole('dialog', { name: '과제를 제출할까요?', exact: true }).getByRole('button', { name: '제출 확정', exact: true }).click();
    const posted = await posting;
    expect(posted.status()).toBe(200);
    const submission = await posted.json();
    await expect(member).toHaveURL(`/assignments/${assignment.id}`);

    await staff.goto(`/admin/submissions?submission=${submission.id}`);
    const review = staff.getByRole('dialog', { name: /제출 검토/ });
    await review.getByLabel('점수 / 100', { exact: true }).fill('87');
    await review.getByLabel('피드백', { exact: true }).fill('저장된 제출과 평가가 새 세션에서도 유지됩니다.');
    const reviewing = staff.waitForResponse(response => response.url().endsWith(`/api/admin/submissions/${submission.id}/review`) && response.request().method() === 'PATCH');
    await review.getByRole('button', { name: '검토 저장', exact: true }).click();
    expect((await reviewing).status()).toBe(200);
    await expect(review).toBeHidden();

    await member.goto('/rankings');
    const myRow = member.getByRole('table', { name: '분야 순위', exact: true }).locator('[data-current-user="true"]');
    await expect(myRow.getByRole('cell').nth(2)).toHaveText('87');
    await member.reload();
    await expect(myRow.getByRole('cell').nth(2)).toHaveText('87');
    expect((await memberContext.request.get('/api/auth/me')).status()).toBe(200);
    await expectNoBrowserDatabase(member);

    // A separate browser profile receives the same persisted records without copying storage.
    expect(await otherContext.cookies()).toEqual([]);
    await loginInBrowser(other, scenario.member);
    await expect(other.locator('[data-ranking-total]')).toHaveText('87');
    await other.goto(`/assignments/${assignment.id}`);
    await expect(other.getByText('87 / 100', { exact: true })).toBeVisible();
    await other.goto(`/notices/${notice.id}`);
    await expect(other.getByRole('heading', { level: 1 })).toHaveText(notice.title);
    await other.goto('/rankings');
    await expect(other.locator('[data-current-user="true"]').first()).toContainText(scenario.member.name);
    const saved = await (await otherContext.request.get(`/api/assignments/${assignment.id}/submission`)).json();
    expect(saved).toMatchObject({ id: submission.id, score: 87, status: 'REVIEWED' });
    await expectNoBrowserDatabase(other);
    await other.screenshot({ path: testInfo.outputPath('clean-browser-persisted-ranking.png'), fullPage: true });
    await member.getByRole('button', { name: '로그아웃', exact: true }).click();
    await expect(member).toHaveURL('/login');
    expect((await memberContext.request.get('/api/auth/me')).status()).toBe(401);
    expect((await otherContext.request.get('/api/auth/me')).status()).toBe(200);
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map(context => context.close()));
    await scenario.dispose();
  }
});

test('API failures show retry without replacing server assignments with sample data', async ({ page, context, playwright, baseURL }) => {
  const scenario = await createScenario(playwright, baseURL);
  try {
    const assignment = await scenario.createAssignment();
    await loginAs(context.request, scenario.member.studentId, scenario.member.password);
    for (const failure of [500, 403, 'network'] as const) {
      await page.route('**/api/assignments', route => failure === 'network'
        ? route.abort('failed')
        : route.fulfill({ status: failure, contentType: 'application/json', body: JSON.stringify({ code: 'AUDIT_FAILURE', message: '검증용 API 응답 실패' }) }));
      await page.goto('/assignments');
      await expect(page.getByText('과제를 불러오지 못했습니다', { exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: new RegExp(assignment.title) })).toHaveCount(0);
      await page.unroute('**/api/assignments');
      await page.getByRole('button', { name: '다시 시도', exact: true }).click();
      await expect(page.getByRole('link', { name: new RegExp(assignment.title) }).first()).toBeVisible();
    }
    await expectNoBrowserDatabase(page);
  } finally { await scenario.dispose(); }
});
