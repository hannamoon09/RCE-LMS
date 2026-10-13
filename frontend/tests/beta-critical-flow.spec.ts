import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { csrf, fixtureName } from './api-helpers';
import { createScenario, type Scenario } from './scenario';

type Account = { id: string; name: string; studentId: string; password: string };
type FileInfo = { id: string; name: string; size: number; type: string };
type Assignment = { id: string; title: string; description: string; deadline: string; attachments: FileInfo[] };
type Submission = { id: string; userId: string; assignmentId: string; status: string; content: string | null; files: FileInfo[]; score: number | null; feedback: string | null; reviewedAt: string | null; reviewedBy: string | null };
type Ranking = { rank: number; name: string; totalScore: number; averageScore: number; reviewedCount: number; isMe: boolean };
const root = fileURLToPath(new URL('../../', import.meta.url));

/** Read-only evidence, always the same disposable database enforced by Scenario. */
function databaseValue(statement: string) {
  if (!process.env.DB_USERNAME || !statement.startsWith('SELECT ')) throw new Error('Read-only E2E database inspection requires scripts/e2e-test.sh.');
  return execFileSync('docker', ['compose', 'exec', '-T', 'postgres', 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', process.env.DB_USERNAME, '-d', 'rce_lms_e2e'], { cwd: root, input: statement, encoding: 'utf8' }).trim();
}
function uuid(value: string) { expect(value).toMatch(/^[a-f\d-]{36}$/i); return `'${value}'`; }

async function noBrowserDatabase(page: Page) {
  expect(await page.evaluate(async () => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage), databases: (await indexedDB.databases()).map(item => item.name) }))).toEqual({ local: [], session: [], databases: [] });
}
async function login(page: Page, account: Account) {
  await page.goto('/login');
  await expect(page.getByLabel('학번', { exact: true })).toBeEnabled();
  await noBrowserDatabase(page);
  const csrfResponse = await page.request.get('/api/csrf');
  expect(csrfResponse.status()).toBe(200);
  expect(await csrfResponse.json()).toMatchObject({ headerName: 'X-XSRF-TOKEN', token: expect.any(String) });
  await page.getByLabel('학번', { exact: true }).fill(account.studentId);
  await page.getByLabel('비밀번호', { exact: true }).fill(account.password);
  const pending = page.waitForResponse(response => response.url().endsWith('/api/auth/login') && response.request().method() === 'POST');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  const response = await pending;
  expect(response.status()).toBe(200);
  expect(response.request().headers()['x-xsrf-token']).toBeTruthy();
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(account.name);
  expect((await page.context().cookies()).find(cookie => cookie.name === 'JSESSIONID')).toMatchObject({ httpOnly: true, sameSite: 'Lax' });
  const me = await page.request.get('/api/auth/me');
  expect(me.status()).toBe(200);
  expect(await me.json()).toMatchObject({ id: account.id, studentId: account.studentId, name: account.name, active: true });
}
async function createMember(page: Page, scenario: Scenario, label: string): Promise<Account> {
  const input = { name: fixtureName(`[E2E] ${label}`), studentId: `82${Date.now()}${Math.floor(Math.random() * 10000)}`, initialPassword: `Beta-${randomUUID()}!` };
  await page.goto('/admin/users');
  await page.getByRole('button', { name: '학생 추가', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '학생 계정 추가', exact: true });
  await editor.getByLabel('이름', { exact: true }).fill(input.name);
  await editor.getByLabel('학번', { exact: true }).fill(input.studentId);
  await editor.getByLabel('초기 비밀번호', { exact: true }).fill(input.initialPassword);
  await expect(editor.getByRole('combobox')).toHaveCount(0);
  const pending = page.waitForResponse(response => response.url().endsWith('/api/admin/users') && response.request().method() === 'POST');
  await editor.getByRole('button', { name: '계정 생성', exact: true }).click();
  const response = await pending;
  expect(response.status()).toBe(201);
  const user = await response.json();
  scenario.registerUser(user.id);
  expect(user).toMatchObject({ name: input.name, studentId: input.studentId, role: 'MEMBER', track: 'WEB', active: true });
  expect(user).not.toHaveProperty('passwordHash');
  await expect(editor).toBeHidden();
  await page.getByRole('searchbox', { name: '학생 검색', exact: true }).fill(input.studentId);
  await expect(page.getByRole('button', { name: `${input.name} 수정`, exact: true })).toBeVisible();
  return { ...user, password: input.initialPassword };
}
async function download(page: Page, button: Locator, name: string, bytes: Buffer) {
  const pending = page.waitForEvent('download');
  await button.click();
  const file = await pending;
  expect(file.suggestedFilename()).toBe(name);
  expect(await file.failure()).toBeNull();
  expect(await readFile((await file.path())!)).toEqual(bytes);
}
async function submit(page: Page, assignment: Assignment, content: string, file: { name: string; mimeType: string; buffer: Buffer }, previous?: Submission): Promise<Submission> {
  await page.goto(`/assignments/${assignment.id}`);
  await page.getByRole('link', { name: previous ? '다시 제출하기' : '과제 제출하기', exact: true }).click();
  if (previous) for (const old of previous.files) await page.getByRole('button', { name: `${old.name} 제거`, exact: true }).click();
  await page.getByLabel('메모 및 질문 (선택)', { exact: true }).fill(content);
  await page.getByLabel('제출 파일 선택', { exact: true }).setInputFiles(file);
  await page.getByRole('button', { name: previous ? '다시 제출' : '제출하기', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: previous ? '과제를 다시 제출할까요?' : '과제를 제출할까요?', exact: true });
  if (!content) await expect(confirmation).toContainText('메모 없음');
  const pending = page.waitForResponse(response => response.url().endsWith(`/api/assignments/${assignment.id}/submission`) && response.request().method() === 'POST');
  await confirmation.getByRole('button', { name: '제출 확정', exact: true }).click();
  const response = await pending;
  expect(response.status()).toBe(200);
  const saved: Submission = await response.json();
  expect(saved).toMatchObject({ assignmentId: assignment.id, content: content || null, status: 'PENDING', score: null, feedback: null, reviewedAt: null, reviewedBy: null });
  expect(saved.files).toHaveLength(1);
  expect(saved.files[0]).toMatchObject({ name: file.name, size: file.buffer.length, type: file.mimeType });
  if (previous) expect(saved.id).toBe(previous.id);
  await expect(page).toHaveURL(`/assignments/${assignment.id}`);
  await expect(page.getByText('검토 대기', { exact: true })).toBeVisible();
  await expect(page.getByText(content || '등록된 메모 및 질문이 없습니다.', { exact: true })).toBeVisible();
  await download(page, page.getByRole('button', { name: `${file.name} 다운로드`, exact: true }), file.name, file.buffer);
  return saved;
}
async function review(page: Page, account: Account, submission: Submission, score: number, feedback: string) {
  await page.goto(`/admin/submissions?submission=${submission.id}`);
  const editor = page.getByRole('dialog', { name: `${account.name} · 제출 검토`, exact: true });
  await expect(editor).toBeVisible();
  for (const file of submission.files) await expect(editor.getByRole('button', { name: `${file.name} 다운로드`, exact: true })).toBeVisible();
  await expect(editor.getByText(submission.content || '작성한 메모가 없습니다.', { exact: true })).toBeVisible();
  await editor.getByLabel('점수 / 100', { exact: true }).fill(String(score));
  await editor.getByLabel('피드백', { exact: true }).fill(feedback);
  const pending = page.waitForResponse(response => response.url().endsWith(`/api/admin/submissions/${submission.id}/review`) && response.request().method() === 'PATCH');
  await editor.getByRole('button', { name: '검토 저장', exact: true }).click();
  const response = await pending;
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ id: submission.id, status: 'REVIEWED', score, feedback, reviewedAt: expect.any(String), reviewedBy: expect.any(String) });
  await expect(editor).toBeHidden();
}
async function rankings(context: BrowserContext, admin = false): Promise<Ranking[]> {
  const response = await context.request.get(admin ? '/api/admin/rankings' : '/api/rankings/me');
  expect(response.status()).toBe(200);
  return response.json();
}
async function rankingRow(page: Page, name: string, score: number, count: number) {
  const row = page.getByRole('table', { name: '분야 순위', exact: true }).getByRole('row').filter({ hasText: name });
  await expect(row).toBeVisible();
  await expect(row.getByRole('cell').nth(2)).toHaveText(String(score));
  await expect(row.getByRole('cell').nth(3)).toHaveText(score.toFixed(1));
  await expect(row.getByRole('cell').nth(4)).toHaveText(`${count}개`);
  return row;
}

test('private beta real users create members, upload, review 92 and 80, reset resubmission, and re-review 96', async ({ browser, playwright, baseURL }, testInfo) => {
  test.setTimeout(180_000);
  const web = await createScenario(playwright, baseURL, 'WEB');
  let pwn: Scenario | undefined;
  const contexts: BrowserContext[] = [];
  const runtimeErrors: string[] = [];
  const unexpectedConsoleErrors: string[] = [];
  const serverErrors: string[] = [];
  const requestBursts: string[] = [];
  const expectedAuthConsole: string[] = [];
  const apiCounts = new Map<string, number>();
  const newPage = async () => {
    const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    contexts.push(context);
    expect(await context.cookies()).toEqual([]);
    const page = await context.newPage();
    const recent = new Map<string, number[]>();
    page.on('pageerror', error => runtimeErrors.push(error.message));
    page.on('console', message => {
      if (message.type() !== 'error') return;
      const description = `${message.text()} ${message.location().url}`;
      // The unauthenticated /me probe is an expected 401 before UI login.
      if (message.text().includes('401') && message.location().url.endsWith('/api/auth/me')) expectedAuthConsole.push(description);
      else unexpectedConsoleErrors.push(description);
    });
    page.on('response', response => { if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.request().method()} ${new URL(response.url()).pathname}`); });
    page.on('request', request => {
      const url = new URL(request.url());
      if (!url.pathname.startsWith('/api/')) return;
      const key = `${request.method()} ${url.pathname}`;
      apiCounts.set(key, (apiCounts.get(key) || 0) + 1);
      const now = Date.now();
      const times = [...(recent.get(key) || []).filter(time => now - time < 1000), now];
      recent.set(key, times);
      if (times.length > 20) requestBursts.push(`${key}: ${times.length} requests in one second`);
    });
    return page;
  };
  const phase = async (number: number, title: string, run: () => Promise<void>) => {
    await test.step(`Phase ${number}/13: ${title}`, async () => {
      try { await run(); console.log(`[E2E PHASE ${number}/13] ${title}: PASS`); }
      catch (error) { console.log(`[E2E PHASE ${number}/13] ${title}: FAIL`); throw error; }
    });
  };
  try {
    pwn = await createScenario(playwright, baseURL, 'PWN');
    const staff = await newPage();
    const memberA = await newPage();
    const memberB = await newPage();
    const pwnPage = await newPage();
    let a!: Account;
    let b!: Account;
    let zero!: Account;
    let assignment!: Assignment;
    let submissionA!: Submission;
    let submissionB!: Submission;
    let oldStorageKey = '';
    const description = '[E2E] SQL Injection 분석 과정과 결과를 제출해 주세요.';
    const guide = { name: 'e2e-instructions.txt', mimeType: 'text/plain', buffer: Buffer.from('SQL Injection Basics\n실습 안내와 제출 기준\n') };
    const firstFile = { name: 'e2e-member-a.txt', mimeType: 'text/plain', buffer: Buffer.from('A의 첫 번째 분석 결과\n92점 검토 대상\n') };
    const secondFile = { name: 'e2e-member-b.txt', mimeType: 'text/plain', buffer: Buffer.from('B의 파일만 제출한 분석 결과\n') };
    const replacement = { name: 'e2e-member-a-revised.txt', mimeType: 'text/plain', buffer: Buffer.from('피드백 반영 후 새 분석 결과\n96점 검토 대상\n') };
    const feedback92 = '[E2E] 분석 과정이 좋습니다.';
    const feedback96 = '[E2E] 보완 내용을 확인했습니다.';

    await phase(2, '깨끗한 브라우저 STAFF 로그인과 실제 세션', async () => {
      await login(staff, web.staff);
      for (const [route, title] of [['/admin/users', '학생 관리'], ['/admin/assignments', '과제 관리'], ['/admin/submissions', '제출 검토'], ['/rankings', '분야 순위']]) {
        await staff.goto(route);
        await expect(staff.getByRole('heading', { level: 1 })).toHaveText(title);
      }
      await expect(staff.getByRole('navigation', { name: '주 메뉴', exact: true }).getByRole('link', { name: /운영진/ })).toBeVisible();
    });
    await phase(3, 'STAFF 실제 UI로 WEB MEMBER A/B와 미채점 학생 생성', async () => {
      a = await createMember(staff, web, 'MEMBER A');
      b = await createMember(staff, web, 'MEMBER B');
      zero = await createMember(staff, web, 'ZERO MEMBER');
      await login(memberA, a);
      await memberB.setViewportSize({ width: 375, height: 812 });
      await login(memberB, b);
      await expect.poll(() => memberB.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await login(pwnPage, pwn!.member);
      // The API-created Scenario member supplies a separate inactive ranking fixture.
      const inactive = await web.staffRequest.patch(`/api/admin/users/${web.member.id}`, { headers: await csrf(web.staffRequest), data: { active: false } });
      expect(inactive.status()).toBe(200);
    });
    await phase(4, '첨부 과제 UI 생성, WEB 지정과 다른 트랙 노출 차단', async () => {
      await staff.goto('/admin/assignments?create=1');
      const editor = staff.getByRole('dialog', { name: '새 과제 생성', exact: true });
      const title = fixtureName('[E2E] SQL Injection Basics');
      await editor.getByLabel('과제명', { exact: true }).fill(title);
      await editor.getByLabel('과제 설명', { exact: true }).fill(description);
      const due = new Date(Date.now() + 7 * 86400000);
      await editor.getByLabel('마감 일시', { exact: true }).fill(`${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}T18:00`);
      await expect(editor.getByLabel(/^(분야|트랙|Track)$/)).toHaveCount(0);
      await editor.getByLabel('과제 첨부파일 선택', { exact: true }).setInputFiles(guide);
      const pending = staff.waitForResponse(response => response.url().endsWith('/api/admin/assignments') && response.request().method() === 'POST');
      await editor.getByRole('button', { name: '과제 생성', exact: true }).click();
      const response = await pending;
      expect(response.status()).toBe(201);
      assignment = await response.json();
      expect(assignment).toMatchObject({ title, description });
      expect(new Date(assignment.deadline).getTime()).toBeGreaterThan(Date.now());
      expect(assignment.attachments).toHaveLength(1);
      expect(assignment.attachments[0]).toMatchObject({ name: guide.name, size: guide.buffer.length, type: guide.mimeType });
      expect(databaseValue(`SELECT target_track FROM assignments WHERE id=${uuid(assignment.id)};`)).toBe('WEB');
      await expect(editor).toBeHidden();
      await memberA.goto('/assignments');
      await expect(memberA.getByRole('link').filter({ hasText: title }).first()).toBeVisible();
      await memberA.goto(`/assignments/${assignment.id}`);
      await expect(memberA.getByRole('heading', { level: 1 })).toHaveText(title);
      await expect(memberA.getByText(description, { exact: true })).toBeVisible();
      await expect(memberA.getByText('제출 마감', { exact: true })).toBeVisible();
      await download(memberA, memberA.getByRole('button', { name: `${guide.name} 다운로드`, exact: true }), guide.name, guide.buffer);
      await pwnPage.goto('/assignments');
      await expect(pwnPage.getByRole('heading', { level: 1 })).toHaveText('과제');
      await expect(pwnPage.getByRole('link').filter({ hasText: title })).toHaveCount(0);
      expect((await pwnPage.request.get(`/api/assignments/${assignment.id}`)).status()).toBe(404);
    });
    await phase(5, 'A 텍스트와 파일, B 파일만 제출 및 서버 저장', async () => {
      submissionA = await submit(memberA, assignment, '[E2E] A의 SQL Injection 분석 메모', firstFile);
      submissionB = await submit(memberB, assignment, '', secondFile);
      await expect.poll(() => memberB.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await memberB.screenshot({ path: testInfo.outputPath('beta-mobile-file-only-submission.png'), fullPage: true });
      expect(submissionA.userId).toBe(a.id);
      expect(submissionB.userId).toBe(b.id);
      oldStorageKey = databaseValue(`SELECT storage_key FROM submission_files WHERE id=${uuid(submissionA.files[0].id)};`);
      expect(oldStorageKey).toMatch(/^[a-f\d-]{36}$/i);
      await access(path.join(root, 'backend-data/e2e-uploads', oldStorageKey));
      await memberA.reload();
      await expect(memberA.getByText(firstFile.name, { exact: true })).toBeVisible();
      await memberA.goto('/submissions');
      const row = memberA.getByRole('row').filter({ hasText: assignment.title });
      await expect(row).toContainText('검토 대기');
      await expect(row).toContainText('검토 중');
      await memberA.goto('/dashboard');
      await expect(memberA.locator('[data-summary="submitted"]')).toContainText('1');
      await noBrowserDatabase(memberA);
    });
    await phase(6, 'STAFF가 A 92점과 B 80점 채점하고 학생 피드백 표시', async () => {
      await review(staff, a, submissionA, 92, feedback92);
      await review(staff, b, submissionB, 80, '[E2E] 기본 과정을 잘 수행했습니다.');
      await memberA.goto(`/assignments/${assignment.id}`);
      await expect(memberA.getByText('92 / 100', { exact: true })).toBeVisible();
      await expect(memberA.getByText(feedback92, { exact: true })).toBeVisible();
      await expect(memberA.getByText('검토 완료', { exact: true })).toBeVisible();
      await memberA.screenshot({ path: testInfo.outputPath('beta-reviewed-92.png'), fullPage: true });
    });
    await phase(7, '92/80 실제 순위와 STAFF·비활성·다른 트랙 제외', async () => {
      const entries = await rankings(memberA.context());
      const aEntry = entries.find(entry => entry.name === a.name)!;
      const bEntry = entries.find(entry => entry.name === b.name)!;
      expect(aEntry).toMatchObject({ totalScore: 92, averageScore: 92, reviewedCount: 1, isMe: true });
      expect(bEntry).toMatchObject({ totalScore: 80, averageScore: 80, reviewedCount: 1, isMe: false });
      expect(aEntry.rank).toBeLessThan(bEntry.rank);
      expect(entries.find(entry => entry.name === zero.name)).toMatchObject({ totalScore: 0, averageScore: 0, reviewedCount: 0 });
      expect(entries.some(entry => [web.staff.name, web.member.name, pwn!.member.name, pwn!.staff.name].includes(entry.name))).toBe(false);
      const users = await (await web.staffRequest.get('/api/admin/users')).json() as Array<{ name: string; role: string; track: string; active: boolean }>;
      const eligible = users.filter(user => user.role === 'MEMBER' && user.track === 'WEB' && user.active).map(user => user.name).sort();
      expect(entries.map(entry => entry.name).sort()).toEqual(eligible);
      await memberA.goto('/rankings');
      await expect(await rankingRow(memberA, a.name, 92, 1)).toHaveAttribute('data-rank', String(aEntry.rank));
      await expect(await rankingRow(memberA, b.name, 80, 1)).toHaveAttribute('data-rank', String(bEntry.rank));
      await rankingRow(memberA, zero.name, 0, 0);
      await memberA.screenshot({ path: testInfo.outputPath('beta-ranking-92-80.png'), fullPage: true });
      await memberA.reload();
      await rankingRow(memberA, a.name, 92, 1);
      expect((await memberA.request.get('/api/auth/me')).status()).toBe(200);
    });
    await phase(8, '새 파일 재제출 즉시 점수·피드백·검토 정보·순위 초기화', async () => {
      const oldFile = submissionA.files[0];
      submissionA = await submit(memberA, assignment, '[E2E] 피드백을 반영한 재제출 메모', replacement, submissionA);
      expect(submissionA.files[0].id).not.toBe(oldFile.id);
      await expect(memberA.getByText('92 / 100', { exact: true })).toHaveCount(0);
      await expect(memberA.getByText(feedback92, { exact: true })).toHaveCount(0);
      await expect(memberA.getByRole('button', { name: `${oldFile.name} 다운로드`, exact: true })).toHaveCount(0);
      expect((await memberA.request.get(`/api/files/${oldFile.id}`)).status()).toBe(404);
      expect(databaseValue(`SELECT count(*) FROM submission_files WHERE id=${uuid(oldFile.id)};`)).toBe('0');
      await expect.poll(async () => { try { await access(path.join(root, 'backend-data/e2e-uploads', oldStorageKey)); return true; } catch { return false; } }).toBe(false);
      // Use in-app navigation to detect stale ranking caches after a successful mutation.
      await memberA.getByRole('navigation', { name: '주 메뉴', exact: true }).getByRole('link', { name: '순위', exact: true }).click();
      await rankingRow(memberA, a.name, 0, 0);
      await rankingRow(memberA, b.name, 80, 1);
      const entries = await rankings(memberA.context());
      expect(entries.find(entry => entry.name === a.name)).toMatchObject({ totalScore: 0, averageScore: 0, reviewedCount: 0 });
      expect(entries.find(entry => entry.name === b.name)!.rank).toBeLessThan(entries.find(entry => entry.name === a.name)!.rank);
      await memberA.getByRole('navigation', { name: '주 메뉴', exact: true }).getByRole('link', { name: '대시보드', exact: true }).click();
      await expect(memberA.locator('[data-ranking-total]')).toHaveText('0');
      await expect(memberA.locator('[data-ranking-average]')).toHaveText('0.0');
      await memberA.screenshot({ path: testInfo.outputPath('beta-resubmission-score-reset.png'), fullPage: true });
    });
    await phase(9, '96점 재채점, 새 브라우저 서버 복구와 저장소·런타임 확인', async () => {
      await staff.setViewportSize({ width: 375, height: 812 });
      await review(staff, a, submissionA, 96, feedback96);
      await expect.poll(() => staff.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await memberA.goto('/rankings');
      await rankingRow(memberA, a.name, 96, 1);
      await rankingRow(memberA, b.name, 80, 1);
      const current = await rankings(memberA.context());
      expect(current.find(entry => entry.name === a.name)!.rank).toBeLessThan(current.find(entry => entry.name === b.name)!.rank);
      const fresh = await newPage();
      await fresh.setViewportSize({ width: 375, height: 812 });
      await login(fresh, a);
      await expect(fresh.locator('[data-ranking-total]')).toHaveText('96');
      await expect(fresh.locator('[data-ranking-average]')).toHaveText('96.0');
      await fresh.goto(`/assignments/${assignment.id}`);
      await expect(fresh.getByText('96 / 100', { exact: true })).toBeVisible();
      await expect(fresh.getByText(feedback96, { exact: true })).toBeVisible();
      await download(fresh, fresh.getByRole('button', { name: `${replacement.name} 다운로드`, exact: true }), replacement.name, replacement.buffer);
      const restored = await fresh.request.get(`/api/assignments/${assignment.id}/submission`);
      expect(restored.status()).toBe(200);
      expect(await restored.json()).toMatchObject({ id: submissionA.id, score: 96, feedback: feedback96, status: 'REVIEWED', files: submissionA.files });
      await fresh.goto('/rankings');
      const mobileRanking = fresh.getByRole('article', { name: `${a.name} 순위`, exact: true });
      await expect(mobileRanking).toBeVisible();
      await expect(mobileRanking.locator('dd')).toHaveText(['96', '96.0', '1개']);
      await expect.poll(() => fresh.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      for (const page of [staff, memberA, memberB, pwnPage, fresh]) await noBrowserDatabase(page);
      await fresh.screenshot({ path: testInfo.outputPath('beta-new-browser-reviewed-96.png'), fullPage: true });
      expect(runtimeErrors).toEqual([]);
      expect(unexpectedConsoleErrors).toEqual([]);
      expect(serverErrors).toEqual([]);
      expect(requestBursts).toEqual([]);
    });
  } finally {
    await testInfo.attach('beta-runtime-observations', { body: JSON.stringify({ runtimeErrors, unexpectedConsoleErrors, expectedUnauthenticatedConsoleErrors: expectedAuthConsole, serverErrors, requestBursts, apiCounts: Object.fromEntries(apiCounts), repeatedRequestThreshold: 'More than 20 same endpoint requests per second in one page' }, null, 2), contentType: 'application/json' });
    await Promise.all(contexts.map(context => context.close()));
    try { await pwn?.dispose(); } finally { await web.dispose(); }
  }
});
