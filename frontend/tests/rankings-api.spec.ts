import { test, expect, type APIRequestContext } from '@playwright/test';
import { csrf, fixtureName, loginAs, staffStudentId } from './api-helpers';

type Entry = { rank: number; name: string; totalScore: number; averageScore: number; reviewedCount: number; isMe: boolean };
const expectedFields = ['averageScore', 'isMe', 'name', 'rank', 'reviewedCount', 'totalScore'];

async function createMember(staff: APIRequestContext, label: string) {
  const input = { name: fixtureName(label), studentId: `91${Date.now()}${Math.floor(Math.random() * 10000)}`, initialPassword: `Ranking-${Date.now()}!` };
  const response = await staff.post('/api/admin/users', { headers: await csrf(staff), data: input });
  expect(response.status()).toBe(201);
  return { ...await response.json(), password: input.initialPassword };
}

async function createAssignment(staff: APIRequestContext) {
  const response = await staff.post('/api/admin/assignments', { headers: await csrf(staff), data: {
    title: fixtureName('서버 순위 실습'), description: '채점과 재제출에 따른 순위 갱신을 확인합니다.', difficulty: 'Medium', deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
  } });
  expect(response.status()).toBe(201);
  return response.json();
}

async function submit(member: APIRequestContext, assignmentId: string) {
  const response = await member.post(`/api/assignments/${assignmentId}/submission`, { headers: await csrf(member), data: { content: '순위 검증용 실습 결과입니다.' } });
  expect(response.status()).toBe(200);
  return response.json();
}

async function review(staff: APIRequestContext, submissionId: string, score: number) {
  const response = await staff.patch(`/api/admin/submissions/${submissionId}/review`, { headers: await csrf(staff), data: { score, feedback: '실습 결과를 확인했습니다.' } });
  expect(response.status()).toBe(200);
}

async function rankings(request: APIRequestContext, admin = false): Promise<Entry[]> {
  const response = await request.get(admin ? '/api/admin/rankings' : '/api/rankings/me');
  expect(response.status()).toBe(200);
  const entries: Entry[] = await response.json();
  entries.forEach((entry, index) => {
    expect(Object.keys(entry).sort()).toEqual(expectedFields);
    expect(entry.rank).toBe(index + 1);
  });
  return entries;
}

test('server rankings use reviewed totals, include zero-score members, exclude inactive accounts and expose only six fields', async ({ request, playwright }, testInfo) => {
  await loginAs(request, staffStudentId);
  const first = await createMember(request, '순위 합계 학생');
  const second = await createMember(request, '순위 단일 학생');
  const zero = await createMember(request, '순위 미채점 학생');
  const member = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
  const peer = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
  const otherTrack = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
  try {
    await loginAs(member, first.studentId, first.password);
    await loginAs(peer, second.studentId, second.password);
    const one = await createAssignment(request);
    const two = await createAssignment(request);
    await review(request, (await submit(member, one.id)).id, 90);
    await review(request, (await submit(member, two.id)).id, 90);
    await review(request, (await submit(peer, one.id)).id, 100);
    const entries = await rankings(member);
    expect(entries.find(entry => entry.name === first.name)).toMatchObject({ totalScore: 180, averageScore: 90, reviewedCount: 2, isMe: true });
    expect(entries.find(entry => entry.name === second.name)).toMatchObject({ totalScore: 100, averageScore: 100, reviewedCount: 1, isMe: false });
    expect(entries.find(entry => entry.name === zero.name)).toMatchObject({ rank: expect.any(Number), totalScore: 0, averageScore: 0, reviewedCount: 0, isMe: false });
    expect(entries.findIndex(entry => entry.name === first.name)).toBeLessThan(entries.findIndex(entry => entry.name === second.name));
    expect(entries.filter(entry => entry.isMe)).toHaveLength(1);
    expect((await rankings(request, true)).every(entry => !entry.isMe)).toBe(true);
    expect((await member.get('/api/admin/rankings')).status()).toBe(403);
    expect((await request.get('/api/rankings/me')).status()).toBe(403);
    await loginAs(otherTrack, '20260002');
    expect((await rankings(otherTrack)).some(entry => [first.name, second.name, zero.name].includes(entry.name))).toBe(false);
    expect((await request.patch(`/api/admin/users/${second.id}`, { headers: await csrf(request), data: { active: false } })).status()).toBe(200);
    expect((await rankings(request, true)).some(entry => entry.name === second.name)).toBe(false);
    await submit(member, one.id);
    expect((await rankings(member)).find(entry => entry.isMe)).toMatchObject({ totalScore: 90, averageScore: 90, reviewedCount: 1 });
  } finally { await member.dispose(); await peer.dispose(); await otherTrack.dispose(); }
});

test('member dashboard, profile and responsive rankings show server scores and refresh after UI resubmission without reloading', async ({ page, context, playwright }, testInfo) => {
  const staff = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await loginAs(staff, staffStudentId);
    const member = await createMember(staff, '순위 화면 학생');
    await loginAs(context.request, member.studentId, member.password);
    const assignment = await createAssignment(staff);
    await review(staff, (await submit(context.request, assignment.id)).id, 91);
    const current = (await rankings(context.request)).find(entry => entry.isMe)!;
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/dashboard');
    await expect(page.locator('[data-ranking-total]')).toHaveText('91');
    await expect(page.locator('[data-ranking-average]')).toHaveText('91.0');
    await expect(page.locator('[data-ranking-rank]')).toContainText(String(current.rank).padStart(2, '0'));
    await page.getByRole('navigation', { name: '주 메뉴', exact: true }).getByRole('link', { name: '프로필', exact: true }).click();
    await expect(page.locator('[data-ranking-stat="rank"]')).toHaveText(`${current.rank}위`);
    await expect(page.locator('[data-ranking-stat="total"]')).toHaveText('91');
    await expect(page.locator('[data-ranking-stat="average"]')).toHaveText('91.0');
    await expect(page.locator('[data-ranking-stat="reviewed"]')).toHaveText('1');
    await page.getByRole('navigation', { name: '주 메뉴', exact: true }).getByRole('link', { name: '순위', exact: true }).click();
    const currentRow = page.getByRole('table', { name: '분야 순위', exact: true }).locator('[data-current-user="true"]');
    await expect(currentRow).toContainText(member.name);
    await expect(currentRow).toHaveAttribute('data-rank', String(current.rank));
    await expect(currentRow.getByRole('cell').nth(2)).toHaveText('91');
    await page.screenshot({ path: testInfo.outputPath('ranking-member-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByRole('article', { name: `${member.name} 순위`, exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('ranking-member-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('navigation', { name: '주 메뉴', exact: true }).getByRole('link', { name: '과제', exact: true }).click();
    await page.getByRole('searchbox', { name: '과제 검색', exact: true }).fill(assignment.title);
    await page.getByRole('link', { name: new RegExp(assignment.title) }).first().click();
    await page.getByRole('link', { name: '다시 제출하기', exact: true }).click();
    await page.getByLabel('메모 및 질문 (선택)', { exact: true }).fill('다시 검토할 실습 내용을 보완했습니다.');
    await page.getByRole('button', { name: '다시 제출', exact: true }).click();
    const refreshing = page.waitForResponse(response => response.url().endsWith('/api/rankings/me') && response.status() === 200);
    await page.getByRole('dialog', { name: '과제를 다시 제출할까요?', exact: true }).getByRole('button', { name: '제출 확정', exact: true }).click();
    await expect(page).toHaveURL(`/assignments/${assignment.id}`);
    await refreshing;
    await page.getByRole('navigation', { name: '주 메뉴', exact: true }).getByRole('link', { name: '순위', exact: true }).click();
    await expect(currentRow.getByRole('cell').nth(2)).toHaveText('0');
    await expect(currentRow.getByRole('cell').nth(3)).toHaveText('0.0');
    await expect(currentRow.getByRole('cell').nth(4)).toHaveText('0개');
    await expect(currentRow).toHaveAttribute('data-rank', /[1-9]\d*/);
    await page.getByRole('navigation', { name: '주 메뉴', exact: true }).getByRole('link', { name: '대시보드', exact: true }).click();
    await expect(page.locator('[data-ranking-total]')).toHaveText('0');
    await expect(page.locator('[data-ranking-average]')).toHaveText('0.0');
    expect(errors).toEqual([]);
  } finally { await staff.dispose(); }
});

test('staff rankings keep a read-only own FIELD and refresh after review and account deactivation in the same application', async ({ page, context, playwright }, testInfo) => {
  await loginAs(context.request, staffStudentId);
  const member = await createMember(context.request, '운영진 순위 학생');
  const memberRequest = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await loginAs(memberRequest, member.studentId, member.password);
    const assignment = await createAssignment(context.request);
    await submit(memberRequest, assignment.id);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/rankings?track=PWN');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('분야 순위');
    await expect(page.locator('main')).toContainText('FIELD 웹해킹');
    await expect(page.getByRole('group', { name: '순위 분야', exact: true })).toHaveCount(0);
    await expect(page.getByRole('combobox')).toHaveCount(0);
    await expect(page.locator('[data-current-user="true"]')).toHaveCount(0);
    const row = page.getByRole('table', { name: '분야 순위', exact: true }).getByRole('row').filter({ hasText: member.name });
    await expect(row.getByRole('cell').nth(2)).toHaveText('0');
    await page.getByRole('navigation', { name: '주 메뉴', exact: true }).getByRole('link', { name: /운영진/ }).click();
    await page.getByRole('navigation', { name: '운영진 메뉴', exact: true }).getByRole('link', { name: '제출 검토', exact: true }).click();
    await page.getByRole('searchbox', { name: '제출물 검색', exact: true }).fill(assignment.title);
    await page.getByRole('button', { name: '검토하기', exact: true }).click();
    const editor = page.getByRole('dialog', { name: /제출 검토/ });
    await editor.getByLabel('점수 / 100', { exact: true }).fill('97');
    const reviewing = page.waitForResponse(response => response.url().endsWith('/api/admin/rankings') && response.status() === 200);
    await editor.getByRole('button', { name: '검토 저장', exact: true }).click();
    await expect(editor).not.toBeVisible();
    await reviewing;
    await page.getByRole('navigation', { name: '주 메뉴', exact: true }).getByRole('link', { name: '순위', exact: true }).click();
    await expect(row.getByRole('cell').nth(2)).toHaveText('97');
    await page.screenshot({ path: testInfo.outputPath('ranking-staff-desktop.png'), fullPage: true });
    await page.getByRole('navigation', { name: '주 메뉴', exact: true }).getByRole('link', { name: /운영진/ }).click();
    await page.getByRole('navigation', { name: '운영진 메뉴', exact: true }).getByRole('link', { name: '학생 관리', exact: true }).click();
    await page.getByRole('searchbox', { name: '학생 검색', exact: true }).fill(member.studentId);
    await page.getByRole('button', { name: `${member.name} 수정`, exact: true }).click();
    const account = page.getByRole('dialog', { name: '학생 계정 수정', exact: true });
    await account.getByLabel('활성 계정', { exact: true }).uncheck();
    const deactivating = page.waitForResponse(response => response.url().endsWith('/api/admin/rankings') && response.status() === 200);
    await account.getByRole('button', { name: '변경 사항 저장', exact: true }).click();
    await expect(account).not.toBeVisible();
    await deactivating;
    await page.getByRole('navigation', { name: '주 메뉴', exact: true }).getByRole('link', { name: '순위', exact: true }).click();
    await expect(row).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { await memberRequest.dispose(); }
});
