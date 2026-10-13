import { test, expect, type APIRequestContext } from '@playwright/test';
import { csrf, fixtureName, loginAs, memberStudentId, staffStudentId } from './api-helpers';

async function createAssignment(request: APIRequestContext, label: string) {
  const input = { title: fixtureName(label), description: '제출 내용을 기록하고 검토를 기다려 주세요.', difficulty: 'Medium', deadline: new Date(Date.now() + 7 * 86400000).toISOString() };
  const response = await request.post('/api/admin/assignments', { headers: await csrf(request), data: input });
  expect(response.status()).toBe(201);
  return { ...(await response.json()), input } as { id: string; title: string; input: typeof input };
}

// Fixtures with submissions intentionally remain in the isolated rce_lms_e2e database.
// scripts/e2e-server.sh resets that dedicated database before each test run.
test('member submissions persist, resubmission replaces the same record, and assignment deletion is protected', async ({ request, playwright }, testInfo) => {
  await loginAs(request, staffStudentId);
  const assignment = await createAssignment(request, '제출 API 검증');
  const member = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
  try {
    const user = await loginAs(member, memberStudentId);
    const missing = await member.get(`/api/assignments/${assignment.id}/submission`);
    expect(missing.status()).toBe(404);
    expect(await missing.json()).toMatchObject({ code: 'SUBMISSION_NOT_FOUND' });

    const first = await member.post(`/api/assignments/${assignment.id}/submission`, { headers: await csrf(member), data: { content: '첫 번째 실습 메모' } });
    expect(first.status()).toBe(200);
    const saved = await first.json();
    expect(saved).toMatchObject({ id: expect.any(String), assignmentId: assignment.id, userId: user.id, content: '첫 번째 실습 메모', status: 'PENDING', score: null, feedback: null, reviewedAt: null, reviewedBy: null });
    const stored = await member.get(`/api/assignments/${assignment.id}/submission`);
    expect(stored.status()).toBe(200);
    expect(await stored.json()).toMatchObject({ id: saved.id, content: '첫 번째 실습 메모' });

    const second = await member.post(`/api/assignments/${assignment.id}/submission`, { headers: await csrf(member), data: { content: '보충한 두 번째 실습 메모' } });
    expect(second.status()).toBe(200);
    expect(await second.json()).toMatchObject({ id: saved.id, content: '보충한 두 번째 실습 메모', status: 'PENDING', score: null, feedback: null, reviewedAt: null, reviewedBy: null });
    const mine = await member.get('/api/submissions/me');
    expect(mine.status()).toBe(200);
    const submissions = await mine.json() as { id: string; userId: string; assignmentId: string }[];
    expect(submissions.filter(item => item.assignmentId === assignment.id)).toHaveLength(1);
    expect(submissions.every(item => item.userId === user.id)).toBe(true);

    const blocked = await request.delete(`/api/admin/assignments/${assignment.id}`, { headers: await csrf(request) });
    expect(blocked.status()).toBe(409);
    expect(await blocked.json()).toMatchObject({ code: 'ASSIGNMENT_HAS_SUBMISSIONS' });
    expect((await member.get(`/api/assignments/${assignment.id}/submission`)).status()).toBe(200);
  } finally { await member.dispose(); }
});

test('submission APIs enforce track, member role, nonempty content and deadline', async ({ request, playwright }, testInfo) => {
  await loginAs(request, staffStudentId);
  const assignment = await createAssignment(request, '제출 권한 검증');
  const member = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
  const pwn = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
  try {
    await loginAs(member, memberStudentId);
    for (const data of [{}, { content: '' }, { content: '  ' }]) {
      const empty = await member.post(`/api/assignments/${assignment.id}/submission`, { headers: await csrf(member), data });
      expect(empty.status()).toBe(400);
      expect(await empty.json()).toMatchObject({ code: 'EMPTY_SUBMISSION' });
    }
    expect((await request.get('/api/submissions/me')).status()).toBe(403);
    expect((await request.post(`/api/assignments/${assignment.id}/submission`, { headers: await csrf(request), data: { content: '운영진 제출 금지' } })).status()).toBe(403);

    await loginAs(pwn, '20260002');
    expect((await pwn.get(`/api/assignments/${assignment.id}/submission`)).status()).toBe(404);
    expect((await pwn.post(`/api/assignments/${assignment.id}/submission`, { headers: await csrf(pwn), data: { content: '다른 분야 제출 금지' } })).status()).toBe(404);

    const closed = await request.patch(`/api/admin/assignments/${assignment.id}`, { headers: await csrf(request), data: { ...assignment.input, deadline: new Date(Date.now() - 60_000).toISOString() } });
    expect(closed.status()).toBe(200);
    const late = await member.post(`/api/assignments/${assignment.id}/submission`, { headers: await csrf(member), data: { content: '마감 후 제출 금지' } });
    expect(late.status()).toBe(409);
    expect(await late.json()).toMatchObject({ code: 'ASSIGNMENT_CLOSED' });
  } finally { await member.dispose(); await pwn.dispose(); }
});

test('the existing submission UI saves and resubmits server data and staff sees the protected deletion error', async ({ page, context, browser }, testInfo) => {
  await loginAs(context.request, staffStudentId);
  const assignment = await createAssignment(context.request, '화면 제출 검증');
  const memberContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const errors: string[] = [];
  try {
    await loginAs(memberContext.request, memberStudentId);
    const memberPage = await memberContext.newPage();
    memberPage.on('pageerror', error => errors.push(error.message));
    await memberPage.goto(`/assignments/${assignment.id}/submit`);
    await memberPage.getByLabel('메모 및 질문 (선택)', { exact: true }).fill('브라우저에서 제출한 첫 메모입니다.');
    await memberPage.getByRole('button', { name: '제출하기', exact: true }).click();
    const firstResponse = memberPage.waitForResponse(response => response.url().endsWith(`/api/assignments/${assignment.id}/submission`) && response.request().method() === 'POST');
    await memberPage.getByRole('dialog', { name: '과제를 제출할까요?' }).getByRole('button', { name: '제출 확정', exact: true }).click();
    const first = await firstResponse;
    expect(first.status()).toBe(200);
    const saved = await first.json();
    await expect(memberPage).toHaveURL(`/assignments/${assignment.id}`);
    await expect(memberPage.getByText('브라우저에서 제출한 첫 메모입니다.', { exact: true })).toBeVisible();
    await memberPage.reload();
    await expect(memberPage.getByText('브라우저에서 제출한 첫 메모입니다.', { exact: true })).toBeVisible();
    await memberPage.screenshot({ path: testInfo.outputPath('submission-member-detail.png'), fullPage: true });

    await memberPage.getByRole('link', { name: '다시 제출하기', exact: true }).click();
    await expect(memberPage.getByLabel('메모 및 질문 (선택)', { exact: true })).toHaveValue('브라우저에서 제출한 첫 메모입니다.');
    await memberPage.getByLabel('메모 및 질문 (선택)', { exact: true }).fill('다시 정리하여 제출한 두 번째 메모입니다.');
    await memberPage.getByRole('button', { name: '다시 제출', exact: true }).click();
    const resubmission = memberPage.waitForResponse(response => response.url().endsWith(`/api/assignments/${assignment.id}/submission`) && response.request().method() === 'POST');
    await memberPage.getByRole('dialog', { name: '과제를 다시 제출할까요?' }).getByRole('button', { name: '제출 확정', exact: true }).click();
    const second = await resubmission;
    expect(second.status()).toBe(200);
    expect(await second.json()).toMatchObject({ id: saved.id, content: '다시 정리하여 제출한 두 번째 메모입니다.', status: 'PENDING' });
    await expect(memberPage).toHaveURL(`/assignments/${assignment.id}`);
    await memberPage.reload();
    await expect(memberPage.getByText('다시 정리하여 제출한 두 번째 메모입니다.', { exact: true })).toBeVisible();
    await memberPage.goto('/submissions');
    await expect(memberPage.getByRole('link', { name: assignment.title, exact: true })).toBeVisible();

    await page.emulateMedia({ reducedMotion: 'reduce' });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/admin/assignments');
    await page.getByRole('button', { name: `${assignment.title} 삭제`, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '과제를 삭제할까요?' });
    const deletion = page.waitForResponse(response => response.url().endsWith(`/api/admin/assignments/${assignment.id}`) && response.request().method() === 'DELETE');
    await dialog.getByRole('button', { name: '삭제', exact: true }).click();
    expect((await deletion).status()).toBe(409);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('제출물이 존재하는 과제는 삭제할 수 없습니다.', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('submission-protected-assignment-deletion.png'), fullPage: true });
    expect((await context.request.get(`/api/assignments/${assignment.id}`)).status()).toBe(200);
    expect(errors).toEqual([]);
  } finally { await memberContext.close(); }
});
