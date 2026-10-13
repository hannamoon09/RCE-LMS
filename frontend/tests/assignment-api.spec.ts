import { test, expect, type APIRequestContext } from '@playwright/test';
import { csrf, fixtureName, loginAs, memberStudentId, staffStudentId } from './api-helpers';

const dueDate = () => new Date(Date.now() + 7 * 86400000).toISOString();
const assignmentData = (title: string) => ({ title, description: '서버에 저장되는 과제 안내입니다. 실습 내용을 정리해 주세요.', difficulty: 'Medium', deadline: dueDate() });

async function removeFixture(request: APIRequestContext, id: string | undefined) {
  if (!id) return;
  const response = await request.delete(`/api/admin/assignments/${id}`, { headers: await csrf(request) });
  expect([204, 404]).toContain(response.status());
}

test('assignment APIs restrict list and detail to the authenticated track and forbid member writes', async ({ request, playwright }, testInfo) => {
  await loginAs(request, staffStudentId);
  const member = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
  const otherTrack = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
  let assignmentId: string | undefined;
  try {
    const response = await request.post('/api/admin/assignments', { headers: await csrf(request), data: assignmentData(fixtureName('분야 권한 검증')) });
    expect(response.status()).toBe(201);
    const assignment = await response.json();
    assignmentId = assignment.id;
    expect(assignment).toMatchObject({ id: expect.any(String) });

    await loginAs(member, memberStudentId);
    const list = await member.get('/api/assignments');
    expect(list.status()).toBe(200);
    expect(await list.json()).toEqual(expect.arrayContaining([expect.objectContaining({ id: assignmentId })]));
    const detail = await member.get(`/api/assignments/${assignmentId}`);
    expect(detail.status()).toBe(200);
    expect(await detail.json()).toMatchObject({ id: assignmentId });
    const forbidden = await member.post('/api/admin/assignments', { headers: await csrf(member), data: assignmentData(fixtureName('허용되지 않은 생성')) });
    expect(forbidden.status()).toBe(403);

    await loginAs(otherTrack, '20260002');
    const otherList = await otherTrack.get('/api/assignments');
    expect(otherList.status()).toBe(200);
    expect(await otherList.json()).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: assignmentId })]));
    expect((await otherTrack.get(`/api/assignments/${assignmentId}`)).status()).toBe(404);
  } finally {
    await removeFixture(request, assignmentId);
    await member.dispose();
    await otherTrack.dispose();
  }
});

test('assignment creation rejects client-selected track and author fields', async ({ request }) => {
  await loginAs(request, staffStudentId);
  for (const forged of [{ targetTrack: 'PWN' }, { author: 'forged-author' }]) {
    const response = await request.post('/api/admin/assignments', {
      headers: await csrf(request), data: { ...assignmentData(fixtureName('위조 필드 거부')), ...forged },
    });
    expect(response.status()).toBe(400);
    expect(await response.json()).toMatchObject({ code: expect.any(String), message: expect.any(String) });
  }
});

test('staff creates, edits and deletes an assignment in the preserved UI and a member sees server changes', async ({ page, context, browser }, testInfo) => {
  await loginAs(context.request, staffStudentId);
  const title = fixtureName('실제 API 과제');
  const updatedTitle = `${title} 수정`;
  const memberContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  let assignmentId: string | undefined;
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/admin/assignments');
    await page.getByRole('button', { name: '과제 생성', exact: true }).click();
    const editor = page.getByRole('dialog', { name: '새 과제 생성' });
    await editor.getByLabel('과제명', { exact: true }).fill(title);
    await editor.getByLabel('과제 설명', { exact: true }).fill('기존 화면을 유지한 서버 과제 생성과 수정 검증입니다.');
    await editor.getByLabel('난이도', { exact: true }).selectOption('High');
    await expect(editor.getByLabel(/분야|주차|진행도|수행 항목/)).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('assignment-admin-editor.png'), fullPage: true });
    const created = page.waitForResponse(response => response.url().endsWith('/api/admin/assignments') && response.request().method() === 'POST');
    await editor.getByRole('button', { name: '과제 생성', exact: true }).click();
    const createResponse = await created;
    expect(createResponse.status()).toBe(201);
    const assignment = await createResponse.json();
    assignmentId = assignment.id;
    expect(assignment).toMatchObject({ title, difficulty: 'High' });
    await expect(editor).not.toBeVisible();
    await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible();

    await loginAs(memberContext.request, memberStudentId);
    const memberPage = await memberContext.newPage();
    memberPage.on('pageerror', error => errors.push(error.message));
    await memberPage.goto(`/assignments/${assignmentId}`);
    await expect(memberPage.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(memberPage.getByText('기존 화면을 유지한 서버 과제 생성과 수정 검증입니다.', { exact: true })).toBeVisible();
    await memberPage.screenshot({ path: testInfo.outputPath('assignment-member-detail.png'), fullPage: true });

    await page.getByRole('button', { name: `${title} 수정`, exact: true }).click();
    const editDialog = page.getByRole('dialog', { name: '과제 수정' });
    await editDialog.getByLabel('과제명', { exact: true }).fill(updatedTitle);
    const edited = page.waitForResponse(response => response.url().endsWith(`/api/admin/assignments/${assignmentId}`) && response.request().method() === 'PATCH');
    await editDialog.getByRole('button', { name: '변경 사항 저장', exact: true }).click();
    expect((await edited).status()).toBe(200);
    await expect(editDialog).not.toBeVisible();
    await memberPage.reload();
    await expect(memberPage.getByRole('heading', { level: 1 })).toHaveText(updatedTitle);

    await page.getByRole('button', { name: `${updatedTitle} 삭제`, exact: true }).click();
    const deletion = page.waitForResponse(response => response.url().endsWith(`/api/admin/assignments/${assignmentId}`) && response.request().method() === 'DELETE');
    await page.getByRole('dialog', { name: '과제를 삭제할까요?' }).getByRole('button', { name: '삭제', exact: true }).click();
    expect((await deletion).status()).toBe(204);
    await expect(page.getByRole('button', { name: updatedTitle, exact: true })).toHaveCount(0);
    expect((await memberContext.request.get(`/api/assignments/${assignmentId}`)).status()).toBe(404);
    expect(errors).toEqual([]);
  } finally {
    // Use the server list to recover an ID even if a browser assertion failed immediately after creation.
    if (!assignmentId) {
      const list = await context.request.get('/api/assignments');
      if (list.ok()) assignmentId = (await list.json() as { id: string; title: string }[]).find(item => item.title === title || item.title === updatedTitle)?.id;
    }
    await removeFixture(context.request, assignmentId);
    await memberContext.close();
  }
});
