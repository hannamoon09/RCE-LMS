import { readFile } from 'node:fs/promises';
import { test, expect, type Locator, type Page } from '@playwright/test';
import type { LMSAssignment } from '../src/data/lmsData';
import { csrf, loginAs } from './api-helpers';
import { createScenario, type Scenario } from './scenario';

let scenario: Scenario;
test.beforeEach(async ({ page, context, playwright }, testInfo) => {
  scenario = await createScenario(playwright, testInfo.project.use.baseURL);
  await loginAs(context.request, scenario.staff.studentId, scenario.staff.password);
  await page.setViewportSize({ width: 1440, height: 900 });
});
test.afterEach(async () => { await scenario?.dispose(); });

async function storedAssignment(page: Page, title: string): Promise<LMSAssignment | undefined> {
  const response = await page.request.get('/api/assignments');
  expect(response.status()).toBe(200);
  return (await response.json() as LMSAssignment[]).find(item => item.title === title);
}

async function savedAssignment(page: Page, title: string): Promise<LMSAssignment> {
  await expect.poll(async () => (await storedAssignment(page, title))?.id).toBeTruthy();
  return (await storedAssignment(page, title))!;
}

async function openNewAssignment(page: Page, title: string) {
  await page.goto('/admin/assignments');
  await page.getByRole('button', { name: '과제 생성', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '새 과제 생성', exact: true });
  await dialog.getByLabel('과제명', { exact: true }).fill(title);
  await dialog.getByLabel('과제 설명', { exact: true }).fill('직접 첨부한 자료와 설명을 확인하는 공통 실습 과제입니다.');
  return dialog;
}

async function saveNewAssignment(page: Page, dialog: Locator, title: string) {
  await dialog.getByRole('button', { name: '과제 생성', exact: true }).click();
  await expect(dialog).toBeHidden();
  return savedAssignment(page, title);
}

async function openAssignmentEditor(page: Page, title: string) {
  await page.goto('/admin/assignments');
  await page.getByRole('button', { name: `${title} 수정`, exact: true }).click();
  return page.getByRole('dialog', { name: '과제 수정', exact: true });
}

async function expectDownload(page: Page, link: Locator, filename: string, bytes: Buffer) {
  await expect(link).toBeVisible();
  const pendingDownload = page.waitForEvent('download');
  await link.click();
  const download = await pendingDownload;
  expect(download.suggestedFilename()).toBe(filename);
  expect(await download.failure()).toBeNull();
  const path = await download.path();
  expect(path).not.toBeNull();
  expect(await readFile(path!)).toEqual(bytes);
}

test('an assignment without selected files has no generated attachment', async ({ page }) => {
  const title = '첨부 없는 공통 실습';
  const dialog = await openNewAssignment(page, title);
  await expect(dialog.getByText('선택한 파일이 없습니다.', { exact: true })).toBeVisible();
  await expect(dialog.getByLabel(/^(분야|트랙|과정|주차|수행 항목|필수 수행 항목)$/)).toHaveCount(0);
  await expect(dialog.getByLabel('마감 일시', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: '난이도', exact: true })).toHaveValue('Medium');
  const assignment = await saveNewAssignment(page, dialog, title);
  expect(assignment.attachments).toEqual([]);
  for (const removedField of ['track', 'category', 'course', 'week', 'requirements', 'attachment', 'due']) {
    expect(assignment).not.toHaveProperty(removedField);
  }

  await page.goto(`/assignments/${assignment.id}`);
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('첨부 파일 없음', { exact: true })).toBeVisible();
  await expect(page.getByRole('main').getByRole('button', { name: /다운로드/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('첨부 파일 없음', { exact: true })).toBeVisible();
  expect((await savedAssignment(page, title)).attachments).toEqual([]);
});

test('assignment files preserve their bytes through reload and edits, discard canceled changes, and can be removed', async ({ page }) => {
  const title = '실제 첨부파일 실습';
  const filename = '실습 안내.md';
  const bytes = Buffer.from('# 직접 작성한 실습 안내\n\n한글과 줄바꿈을 그대로 보존합니다.\nrecord=42\n', 'utf8');
  const dialog = await openNewAssignment(page, title);
  await dialog.getByLabel('과제 첨부파일 선택', { exact: true }).setInputFiles({ name: filename, mimeType: 'text/markdown', buffer: bytes });
  await expect(dialog.getByText(filename, { exact: true })).toBeVisible();
  const assignment = await saveNewAssignment(page, dialog, title);
  expect(assignment.attachments).toHaveLength(1);
  expect(assignment.attachments[0]).toMatchObject({ id: expect.any(String), name: filename, size: bytes.length, type: 'text/markdown' });
  expect(assignment.attachments[0]).not.toHaveProperty('source');

  await page.goto(`/assignments/${assignment.id}`);
  await expectDownload(page, page.getByRole('button', { name: `${filename} 다운로드`, exact: true }), filename, bytes);
  await page.reload();
  await expectDownload(page, page.getByRole('button', { name: `${filename} 다운로드`, exact: true }), filename, bytes);

  let editor = await openAssignmentEditor(page, title);
  await expect(editor.getByText(filename, { exact: true })).toBeVisible();
  await editor.getByLabel('과제 설명', { exact: true }).fill('기존 첨부파일을 유지한 채 설명만 수정했습니다.');
  await editor.getByRole('button', { name: '변경 사항 저장', exact: true }).click();
  await expect(editor).toBeHidden();
  await expect.poll(async () => (await storedAssignment(page, title))?.description).toBe('기존 첨부파일을 유지한 채 설명만 수정했습니다.');
  expect((await savedAssignment(page, title)).attachments).toEqual(assignment.attachments);

  editor = await openAssignmentEditor(page, title);
  await editor.getByRole('button', { name: `${filename} 제거`, exact: true }).click();
  await editor.getByLabel('과제 첨부파일 선택', { exact: true }).setInputFiles({ name: '저장하지 않을 파일.txt', mimeType: 'text/plain', buffer: Buffer.from('canceled upload') });
  await editor.getByLabel('과제 설명', { exact: true }).fill('저장하지 않은 설명입니다.');
  await editor.getByRole('button', { name: '취소', exact: true }).click();
  await expect(editor).toBeHidden();
  expect((await savedAssignment(page, title)).attachments).toEqual(assignment.attachments);

  editor = await openAssignmentEditor(page, title);
  await expect(editor.getByText(filename, { exact: true })).toBeVisible();
  await expect(editor.getByText('저장하지 않을 파일.txt', { exact: true })).toHaveCount(0);
  await expect(editor.getByLabel('과제 설명', { exact: true })).toHaveValue('기존 첨부파일을 유지한 채 설명만 수정했습니다.');
  await editor.getByRole('button', { name: '취소', exact: true }).click();
  await expect(editor).toBeHidden();
  await page.goto(`/assignments/${assignment.id}`);
  await expectDownload(page, page.getByRole('button', { name: `${filename} 다운로드`, exact: true }), filename, bytes);

  editor = await openAssignmentEditor(page, title);
  await editor.getByRole('button', { name: `${filename} 제거`, exact: true }).click();
  await expect(editor.getByText('선택한 파일이 없습니다.', { exact: true })).toBeVisible();
  await editor.getByRole('button', { name: '변경 사항 저장', exact: true }).click();
  await expect(editor).toBeHidden();
  await expect.poll(async () => (await storedAssignment(page, title))?.attachments).toEqual([]);
  await page.goto(`/assignments/${assignment.id}`);
  await expect(page.getByText('첨부 파일 없음', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: `${filename} 다운로드`, exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('첨부 파일 없음', { exact: true })).toBeVisible();
});

test('canceling a new assignment discards its selected file and form values', async ({ page }) => {
  const title = '생성을 취소한 과제';
  const dialog = await openNewAssignment(page, title);
  await dialog.getByLabel('과제 첨부파일 선택', { exact: true }).setInputFiles({ name: '취소한 자료.txt', mimeType: 'text/plain', buffer: Buffer.from('not saved') });
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(await storedAssignment(page, title)).toBeUndefined();
  await page.getByRole('button', { name: '과제 생성', exact: true }).click();
  const reopened = page.getByRole('dialog', { name: '새 과제 생성', exact: true });
  await expect(reopened.getByLabel('과제명', { exact: true })).toHaveValue('');
  await expect(reopened.getByLabel('과제 설명', { exact: true })).toHaveValue('');
  await expect(reopened.getByText('선택한 파일이 없습니다.', { exact: true })).toBeVisible();
  await expect(reopened.getByText('취소한 자료.txt', { exact: true })).toHaveCount(0);
});

test('a file-only submission persists and administrators download the original bytes', async ({ page, context }) => {
  const assignment = await scenario.createAssignment();
  await loginAs(context.request, scenario.member.studentId, scenario.member.password);
  const filename = '파일만 제출.txt';
  const bytes = Buffer.from('메모 없이 제출한 실제 파일입니다.\nresult: success\n', 'utf8');
  await page.goto(`/assignments/${assignment.id}/submit`);
  const memo = page.getByRole('textbox', { name: '메모 및 질문 (선택)', exact: true });
  await expect(memo).toHaveValue('');
  await expect(memo).not.toHaveAttribute('required');
  await page.getByLabel('제출 파일 선택', { exact: true }).setInputFiles({ name: filename, mimeType: 'text/plain', buffer: bytes });
  await page.getByRole('button', { name: '제출하기', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: '과제를 제출할까요?', exact: true });
  await expect(confirmation).toContainText('메모 없음');
  await confirmation.getByRole('button', { name: '제출 확정', exact: true }).click();
  await expect(page).toHaveURL(`/assignments/${assignment.id}`);
  await expect(page.getByText('등록된 메모 및 질문이 없습니다.', { exact: true })).toBeVisible();
  await expectDownload(page, page.getByRole('button', { name: `${filename} 다운로드`, exact: true }), filename, bytes);
  await page.reload();
  await expectDownload(page, page.getByRole('button', { name: `${filename} 다운로드`, exact: true }), filename, bytes);

  await loginAs(context.request, scenario.staff.studentId, scenario.staff.password);
  await page.goto('/admin/submissions');
  const row = page.getByRole('row').filter({ hasText: scenario.member.name }).filter({ hasText: assignment.title });
  await row.getByRole('button', { name: '검토하기', exact: true }).click();
  const review = page.getByRole('dialog', { name: `${scenario.member.name} · 제출 검토`, exact: true });
  await expect(review.getByText('작성한 메모가 없습니다.', { exact: true })).toBeVisible();
  await expectDownload(page, review.getByRole('button', { name: `${filename} 다운로드`, exact: true }), filename, bytes);
  await expect(review.getByRole('combobox')).toHaveCount(0);
  await expect(review.getByRole('button', { name: '보완 요청', exact: true })).toHaveCount(0);
  await review.getByLabel('점수 / 100', { exact: true }).fill('92');
  await review.getByLabel('피드백', { exact: true }).fill('첨부파일의 분석 내용을 확인했습니다.');
  await review.getByRole('button', { name: '검토 저장', exact: true }).click();
  await expect(review).toBeHidden();
  await expect(row).toContainText('검토 완료');
  await page.reload();
  await expect(row).toContainText('검토 완료');
  await expect(row).toContainText('92');
});

test('submission review combines own-field assignment, status and search with refresh and reset', async ({ page, playwright }, testInfo) => {
  const one = await scenario.createAssignment();
  const two = await scenario.createAssignment();
  const peer = await scenario.createMember('검토 완료 학생');
  const peerRequest = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
  try {
    await loginAs(peerRequest, peer.studentId, peer.password);
    const submit = async (request: typeof peerRequest, id: string) => {
      const response = await request.post(`/api/assignments/${id}/submission`, { headers: await csrf(request), data: { content: '검색 및 상태 필터 실습' } });
      expect(response.status()).toBe(200); return response.json();
    };
    await submit(scenario.memberRequest, one.id);
    const reviewed = await submit(peerRequest, one.id);
    await submit(scenario.memberRequest, two.id);
    expect((await scenario.staffRequest.patch(`/api/admin/submissions/${reviewed.id}/review`, { headers: await csrf(scenario.staffRequest), data: { score: 92, feedback: '확인했습니다.' } })).status()).toBe(200);
    await page.goto('/admin/submissions');
    const assignment = page.getByRole('combobox', { name: '과제별 제출물', exact: true });
    const search = page.getByRole('searchbox', { name: '제출물 검색', exact: true });
    const rows = page.locator('tbody tr');
    const statuses = page.getByRole('group', { name: '목록 필터', exact: true });
    await expect(statuses.getByRole('button')).toHaveText(['전체', '검토 대기', '검토 완료']);
    await expect(page.getByRole('combobox', { name: '제출물 분야 필터', exact: true })).toHaveCount(0);
    await expect(page.locator('main')).toContainText('FIELD 포너블');
    await assignment.selectOption(one.id);
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: scenario.member.name })).toContainText(one.title);
    await expect(rows.filter({ hasText: peer.name })).toContainText(one.title);
    await statuses.getByRole('button', { name: '검토 대기', exact: true }).click();
    await search.fill(scenario.member.name);
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(scenario.member.name);
    await expect(page).toHaveURL(url => url.searchParams.get('assignment') === one.id && url.searchParams.get('status') === 'pending' && url.searchParams.get('q') === scenario.member.name);
    await page.reload();
    await expect(assignment).toHaveValue(one.id);
    await expect(search).toHaveValue(scenario.member.name);
    await expect(statuses.getByRole('button', { name: '검토 대기', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(rows).toHaveCount(1);
    await search.fill('');
    await statuses.getByRole('button', { name: '검토 완료', exact: true }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(peer.name);
    await assignment.selectOption(two.id);
    await expect(page.getByRole('heading', { name: '조건에 맞는 제출물이 없습니다', exact: true })).toBeVisible();
    await expect(rows).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: '조건에 맞는 제출물이 없습니다', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '필터 초기화', exact: true }).click();
    await expect(page).toHaveURL('/admin/submissions');
    await expect(assignment).toHaveValue('all');
    await expect(search).toHaveValue('');
    await expect(statuses.getByRole('button', { name: '전체', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(rows).toHaveCount(3);
  } finally { await peerRequest.dispose(); }
});

test('student management has read-only own FIELD and includes inactive members on desktop and mobile', async ({ page }) => {
  const inactive = await scenario.createMember('비활성 확인 학생');
  expect((await scenario.staffRequest.patch(`/api/admin/users/${inactive.id}`, { headers: await csrf(scenario.staffRequest), data: { active: false } })).status()).toBe(200);
  await page.goto('/admin/users?track=WEB');
  const main = page.getByRole('main');
  const rows = page.locator('tbody tr');
  const search = page.getByRole('searchbox', { name: '학생 검색', exact: true });
  await expect(main.getByRole('heading', { name: '학생 관리', exact: true })).toBeVisible();
  await expect(main).toContainText('FIELD 포너블');
  await expect(main.getByRole('group', { name: '학생 분야 필터', exact: true })).toHaveCount(0);
  await expect(main.getByRole('link', { name: '회원 관리', exact: true })).toHaveCount(0);
  await expect(rows.filter({ hasText: scenario.member.name })).toBeVisible();
  await expect(rows.filter({ hasText: inactive.name })).toContainText('비활성');
  await expect(rows.filter({ hasText: scenario.staff.name })).toHaveCount(0);
  await expect(main.getByRole('combobox')).toHaveCount(0);
  await search.fill(inactive.studentId);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(inactive.name);
  await page.reload();
  await expect(search).toHaveValue(inactive.studentId);
  await expect(rows).toHaveCount(1);
  await page.setViewportSize({ width: 375, height: 844 });
  await expect(page.locator('table')).toBeHidden();
  await expect(main.getByRole('heading', { name: inactive.name, exact: true })).toBeVisible();
  await expect(main.getByRole('combobox')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await search.fill('no-matching-student');
  await expect(main.getByRole('heading', { name: '조건에 맞는 학생이 없습니다', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '검색 초기화', exact: true }).click();
  await expect(page).toHaveURL('/admin/users');
  await expect(main.getByRole('heading', { name: inactive.name, exact: true })).toBeVisible();
});
