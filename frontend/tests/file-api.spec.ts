import { test, expect, type APIRequestContext } from '@playwright/test';
import { csrf, fixtureName, loginAs, memberStudentId, staffStudentId } from './api-helpers';

type FileInfo = { id: string; name: string; size: number; type: string };
type Upload = { name: string; content: string; type?: string };
const input = (title: string) => ({ title, description: '첨부 자료를 확인하고 실습 결과를 제출해 주세요.', difficulty: 'Medium', deadline: new Date(Date.now() + 7 * 86400000).toISOString() });
function multipart(data: object, files: Upload[] = []) {
  const form = new FormData();
  form.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }), 'data.json');
  for (const file of files) form.append('files', new Blob([file.content], { type: file.type || 'text/plain' }), file.name);
  return form;
}
async function createAssignment(request: APIRequestContext, data: ReturnType<typeof input>, files: Upload[] = []) {
  const response = await request.post('/api/admin/assignments', { headers: await csrf(request), multipart: multipart({ ...data, retainedFileIds: [] }, files) });
  expect(response.status()).toBe(201);
  return await response.json() as { id: string; title: string; attachments: FileInfo[] };
}
async function expectDownload(request: APIRequestContext, file: FileInfo, content: string) {
  const response = await request.get(`/api/files/${file.id}`);
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('no-store');
  expect(response.headers()['content-disposition']).toContain('attachment');
  expect(response.headers()['content-type']).toContain('text/plain');
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(await response.text()).toBe(content);
}

test('assignment attachments upload, retain, replace and download only within the authenticated track', async ({ request, playwright }, testInfo) => {
  await loginAs(request, staffStudentId);
  const data = input(fixtureName('과제 첨부 검증'));
  const member = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
  const other = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
  const anonymous = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
  let assignmentId: string | undefined;
  try {
    const assignment = await createAssignment(request, data, [{ name: 'first-notes.txt', content: '첫 번째 과제 첨부 자료' }]);
    assignmentId = assignment.id;
    expect(assignment.attachments).toHaveLength(1);
    const first = assignment.attachments[0];
    expect(first).toMatchObject({ id: expect.any(String), name: 'first-notes.txt', type: 'text/plain' });
    expect(first).not.toHaveProperty('storageKey');
    await loginAs(member, memberStudentId);
    await expectDownload(member, first, '첫 번째 과제 첨부 자료');
    expect((await anonymous.get(`/api/files/${first.id}`)).status()).toBe(401);
    await loginAs(other, '20260002');
    expect((await other.get(`/api/files/${first.id}`)).status()).toBe(404);

    const retained = await request.patch(`/api/admin/assignments/${assignment.id}`, { headers: await csrf(request), multipart: multipart({ ...data, retainedFileIds: [first.id] }, [{ name: 'second-notes.txt', content: '두 번째 과제 첨부 자료' }]) });
    expect(retained.status()).toBe(200);
    const files = (await retained.json()).attachments as FileInfo[];
    expect(files).toHaveLength(2);
    expect(files.some(file => file.id === first.id)).toBe(true);
    const second = files.find(file => file.id !== first.id)!;
    const jsonEdit = await request.patch(`/api/admin/assignments/${assignment.id}`, { headers: await csrf(request), data: { ...data, title: `${data.title} 수정` } });
    expect(jsonEdit.status()).toBe(200);
    expect((await jsonEdit.json()).attachments).toHaveLength(2);
    const replaced = await request.patch(`/api/admin/assignments/${assignment.id}`, { headers: await csrf(request), multipart: multipart({ ...data, retainedFileIds: [second.id] }) });
    expect(replaced.status()).toBe(200);
    expect((await replaced.json()).attachments).toEqual([second]);
    expect((await member.get(`/api/files/${first.id}`)).status()).toBe(404);
    await expectDownload(member, second, '두 번째 과제 첨부 자료');
  } finally {
    if (assignmentId) expect((await request.delete(`/api/admin/assignments/${assignmentId}`, { headers: await csrf(request) })).status()).toBe(204);
    await member.dispose(); await other.dispose(); await anonymous.dispose();
  }
});

test('file-only submission is persisted, downloadable by its owner and staff, and resubmission removes old files', async ({ request, playwright }, testInfo) => {
  await loginAs(request, staffStudentId);
  const assignment = await createAssignment(request, input(fixtureName('파일만 제출 검증')));
  const member = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
  const other = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
  try {
    await loginAs(member, memberStudentId);
    const first = await member.post(`/api/assignments/${assignment.id}/submission`, { headers: await csrf(member), multipart: multipart({ content: null, retainedFileIds: [] }, [{ name: 'solution.txt', content: '파일만 제출하는 실습 결과' }]) });
    expect(first.status()).toBe(200);
    const saved = await first.json();
    expect(saved).toMatchObject({ id: expect.any(String), content: null, status: 'PENDING', score: null, feedback: null });
    expect(saved.files).toHaveLength(1);
    const file: FileInfo = saved.files[0];
    await expectDownload(member, file, '파일만 제출하는 실습 결과');
    await expectDownload(request, file, '파일만 제출하는 실습 결과');
    await loginAs(other, '20260002');
    expect((await other.get(`/api/files/${file.id}`)).status()).toBe(404);

    const retained = await member.post(`/api/assignments/${assignment.id}/submission`, { headers: await csrf(member), multipart: multipart({ content: '기존 파일을 유지한 보충 설명', retainedFileIds: [file.id] }) });
    expect(retained.status()).toBe(200);
    expect(await retained.json()).toMatchObject({ id: saved.id, files: [file] });
    const textOnly = await member.post(`/api/assignments/${assignment.id}/submission`, { headers: await csrf(member), data: { content: '텍스트로 교체한 제출 내용' } });
    expect(textOnly.status()).toBe(200);
    expect(await textOnly.json()).toMatchObject({ id: saved.id, files: [], content: '텍스트로 교체한 제출 내용' });
    expect((await member.get(`/api/files/${file.id}`)).status()).toBe(404);
  } finally { await member.dispose(); await other.dispose(); }
});

test('existing file pickers upload assignment and file-only submission, preserve files on reload, and download server content', async ({ page, context, browser }, testInfo) => {
  await loginAs(context.request, staffStudentId);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const title = fixtureName('실제 파일 화면 검증');
  const memberContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('/admin/assignments?create=1');
    const editor = page.getByRole('dialog', { name: '새 과제 생성' });
    await editor.getByLabel('과제명', { exact: true }).fill(title);
    await editor.getByLabel('과제 설명', { exact: true }).fill('첨부파일을 내려받아 내용을 확인해 주세요.');
    await editor.getByLabel('과제 첨부파일 선택', { exact: true }).setInputFiles({ name: 'instructions.txt', mimeType: 'text/plain', buffer: Buffer.from('서버에 보관되는 과제 자료') });
    const creation = page.waitForResponse(response => response.url().endsWith('/api/admin/assignments') && response.request().method() === 'POST');
    await editor.getByRole('button', { name: '과제 생성', exact: true }).click();
    const created = await creation;
    expect(created.status()).toBe(201);
    const assignment = await created.json();
    expect(assignment.attachments).toHaveLength(1);
    await expect(editor).not.toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: `${title} 수정`, exact: true }).click();
    await expect(page.getByRole('dialog', { name: '과제 수정' }).getByText('instructions.txt', { exact: true })).toBeVisible();

    await loginAs(memberContext.request, memberStudentId);
    const memberPage = await memberContext.newPage();
    memberPage.on('pageerror', error => errors.push(error.message));
    await memberPage.goto(`/assignments/${assignment.id}`);
    const assignmentDownload = memberPage.waitForEvent('download');
    await memberPage.getByRole('button', { name: 'instructions.txt 다운로드', exact: true }).click();
    expect((await assignmentDownload).suggestedFilename()).toBe('instructions.txt');
    await memberPage.getByRole('link', { name: '과제 제출하기', exact: true }).click();
    await memberPage.getByLabel('제출 파일 선택', { exact: true }).setInputFiles({ name: 'solution.txt', mimeType: 'text/plain', buffer: Buffer.from('메모 없이 첨부파일만 제출한 결과') });
    await expect(memberPage.getByLabel('메모 및 질문 (선택)', { exact: true })).toHaveValue('');
    await memberPage.getByRole('button', { name: '제출하기', exact: true }).click();
    const posting = memberPage.waitForResponse(response => response.url().endsWith(`/api/assignments/${assignment.id}/submission`) && response.request().method() === 'POST');
    await memberPage.getByRole('dialog', { name: '과제를 제출할까요?' }).getByRole('button', { name: '제출 확정', exact: true }).click();
    expect((await posting).status()).toBe(200);
    await expect(memberPage).toHaveURL(`/assignments/${assignment.id}`);
    await memberPage.reload();
    await expect(memberPage.getByText('solution.txt', { exact: true })).toBeVisible();
    await memberPage.screenshot({ path: testInfo.outputPath('file-only-submission-detail.png'), fullPage: true });
    const submissionDownload = memberPage.waitForEvent('download');
    await memberPage.getByRole('button', { name: 'solution.txt 다운로드', exact: true }).click();
    expect((await submissionDownload).suggestedFilename()).toBe('solution.txt');
    await memberPage.getByRole('link', { name: '다시 제출하기', exact: true }).click();
    await expect(memberPage.getByRole('button', { name: 'solution.txt 제거', exact: true })).toBeVisible();
    await memberPage.screenshot({ path: testInfo.outputPath('file-resubmission-editor.png'), fullPage: true });
    expect(errors).toEqual([]);
  } finally { await memberContext.close(); }
});
