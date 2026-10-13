import { test, expect, type APIRequestContext } from '@playwright/test';
import { csrf, fixtureName, loginAs, memberStudentId, staffStudentId } from './api-helpers';

async function reviewFixture(staff: APIRequestContext, member: APIRequestContext) {
  await loginAs(staff, staffStudentId);
  const user = await loginAs(member, memberStudentId);
  const created = await staff.post('/api/admin/assignments', { headers: await csrf(staff), data: {
    title: fixtureName('운영진 검토 과제'), description: '검토와 재제출을 확인할 실습입니다.', difficulty: 'Medium', deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
  } });
  expect(created.status()).toBe(201);
  const assignment = await created.json();
  const posted = await member.post(`/api/assignments/${assignment.id}/submission`, { headers: await csrf(member), data: { content: '운영진 검토를 요청하는 실습 메모' } });
  expect(posted.status()).toBe(200);
  return { assignment, submission: await posted.json(), user };
}

test('admin review APIs filter server submissions, persist feedback, and reset all review fields on resubmission', async ({ request, playwright }, testInfo) => {
  const member = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
  try {
    const { assignment, submission } = await reviewFixture(request, member);
    const pending = await request.get(`/api/admin/submissions?assignmentId=${assignment.id}&status=PENDING`);
    expect(pending.status()).toBe(200);
    expect(await pending.json()).toEqual([expect.objectContaining({ id: submission.id, status: 'PENDING' })]);
    const review = await request.patch(`/api/admin/submissions/${submission.id}/review`, { headers: await csrf(request), data: { score: 87, feedback: '분석 근거를 잘 정리했습니다.' } });
    expect(review.status()).toBe(200);
    expect(await review.json()).toMatchObject({ id: submission.id, status: 'REVIEWED', score: 87, feedback: '분석 근거를 잘 정리했습니다.', reviewedAt: expect.any(String), reviewedBy: expect.any(String) });
    const reviewed = await request.get(`/api/admin/submissions?assignmentId=${assignment.id}&status=REVIEWED`);
    expect(reviewed.status()).toBe(200);
    expect(await reviewed.json()).toEqual([expect.objectContaining({ id: submission.id, score: 87 })]);
    expect((await member.get('/api/admin/submissions')).status()).toBe(403);
    const resubmitted = await member.post(`/api/assignments/${assignment.id}/submission`, { headers: await csrf(member), data: { content: '피드백을 반영한 재제출 메모' } });
    expect(resubmitted.status()).toBe(200);
    expect(await resubmitted.json()).toMatchObject({ id: submission.id, status: 'PENDING', score: null, feedback: null, reviewedAt: null, reviewedBy: null });
    expect(await (await request.get(`/api/admin/submissions?assignmentId=${assignment.id}&status=REVIEWED`)).json()).toEqual([]);
  } finally { await member.dispose(); }
});

test('staff creates and edits a member in the UI, the member logs in, and deactivation invalidates that session', async ({ page, context, browser }, testInfo) => {
  await loginAs(context.request, staffStudentId);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const name = fixtureName('브라우저 학생');
  const updatedName = `${name} 수정`;
  const studentId = `90${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const initialPassword = `Initial-${Date.now()}!`;
  const nextPassword = `Updated-${Date.now()}!`;
  const memberContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('학생 관리');
    await expect(page.getByRole('combobox')).toHaveCount(0);
    await page.getByRole('button', { name: '학생 추가', exact: true }).click();
    const create = page.getByRole('dialog', { name: '학생 계정 추가', exact: true });
    await create.getByLabel('이름', { exact: true }).fill(name);
    await create.getByLabel('학번', { exact: true }).fill(studentId);
    await create.getByLabel('초기 비밀번호', { exact: true }).fill(initialPassword);
    await expect(create.getByRole('combobox')).toHaveCount(0);
    const creating = page.waitForResponse(response => response.url().endsWith('/api/admin/users') && response.request().method() === 'POST');
    await create.getByRole('button', { name: '계정 생성', exact: true }).click();
    const created = await creating;
    expect(created.status()).toBe(201);
    const user = await created.json();
    expect(user).toMatchObject({ studentId, name, role: 'MEMBER', track: 'WEB', active: true });
    expect(user).not.toHaveProperty('passwordHash');
    await expect(create).not.toBeVisible();
    await page.getByRole('searchbox', { name: '학생 검색', exact: true }).fill(studentId);
    await page.getByRole('button', { name: `${name} 수정`, exact: true }).click();
    const edit = page.getByRole('dialog', { name: '학생 계정 수정', exact: true });
    await edit.getByLabel('이름', { exact: true }).fill(updatedName);
    await edit.getByLabel('새 비밀번호 (선택)', { exact: true }).fill(nextPassword);
    const patching = page.waitForResponse(response => response.url().endsWith(`/api/admin/users/${user.id}`) && response.request().method() === 'PATCH');
    await edit.getByRole('button', { name: '변경 사항 저장', exact: true }).click();
    expect((await patching).status()).toBe(200);
    await expect(edit).not.toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: `${updatedName} 수정`, exact: true })).toBeVisible();

    const memberPage = await memberContext.newPage();
    memberPage.on('pageerror', error => errors.push(error.message));
    await memberPage.goto('/login');
    await expect(memberPage.getByLabel('학번', { exact: true })).toBeEnabled();
    await memberPage.getByLabel('학번', { exact: true }).fill(studentId);
    await memberPage.getByLabel('비밀번호', { exact: true }).fill(nextPassword);
    await memberPage.getByRole('button', { name: '로그인', exact: true }).click();
    await expect(memberPage).toHaveURL('/dashboard');
    await expect(memberPage.getByRole('heading', { level: 1 })).toHaveText(updatedName);
    expect((await memberContext.request.get('/api/auth/me')).status()).toBe(200);

    await page.getByRole('button', { name: `${updatedName} 수정`, exact: true }).click();
    await edit.getByLabel('활성 계정', { exact: true }).uncheck();
    await page.screenshot({ path: testInfo.outputPath('admin-member-editor.png'), fullPage: true });
    const deactivating = page.waitForResponse(response => response.url().endsWith(`/api/admin/users/${user.id}`) && response.request().method() === 'PATCH');
    await edit.getByRole('button', { name: '변경 사항 저장', exact: true }).click();
    expect((await deactivating).status()).toBe(200);
    await expect(edit).not.toBeVisible();
    expect((await memberContext.request.get('/api/auth/me')).status()).toBe(401);
    await memberPage.reload();
    await expect(memberPage).toHaveURL('/login');
    const stored = await context.request.get('/api/admin/users');
    expect(await stored.json()).toEqual(expect.arrayContaining([expect.objectContaining({ id: user.id, active: false, name: updatedName })]));
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByRole('button', { name: `${updatedName} 수정`, exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('admin-members-mobile.png'), fullPage: true });
    expect(errors).toEqual([]);
  } finally { await memberContext.close(); }
});

test('existing admin review modal saves score and feedback and member resubmission resets the review', async ({ page, context, browser }, testInfo) => {
  const memberContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    const { assignment, submission } = await reviewFixture(context.request, memberContext.request);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/admin/submissions');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('제출 검토');
    await expect(page.getByLabel('제출물 분야 필터', { exact: true })).toHaveCount(0);
    await page.getByRole('searchbox', { name: '제출물 검색', exact: true }).fill(assignment.title);
    await page.getByLabel('과제별 제출물', { exact: true }).selectOption(assignment.id);
    await page.getByRole('button', { name: '검토 대기', exact: true }).click();
    await page.getByRole('button', { name: '검토하기', exact: true }).click();
    const review = page.getByRole('dialog', { name: /제출 검토/ });
    await review.getByLabel('점수 / 100', { exact: true }).fill('93');
    await review.getByLabel('피드백', { exact: true }).fill('실험 과정을 명확하게 설명했습니다.');
    await page.screenshot({ path: testInfo.outputPath('admin-review-editor.png'), fullPage: true });
    const saving = page.waitForResponse(response => response.url().endsWith(`/api/admin/submissions/${submission.id}/review`) && response.request().method() === 'PATCH');
    await review.getByRole('button', { name: '검토 저장', exact: true }).click();
    expect((await saving).status()).toBe(200);
    await expect(review).not.toBeVisible();
    await page.getByRole('button', { name: '검토 완료', exact: true }).click();
    await expect(page.getByRole('button', { name: '피드백 수정', exact: true })).toBeVisible();

    const memberPage = await memberContext.newPage();
    memberPage.on('pageerror', error => errors.push(error.message));
    await memberPage.goto(`/assignments/${assignment.id}`);
    await expect(memberPage.getByText('93 / 100', { exact: true })).toBeVisible();
    await expect(memberPage.getByText('실험 과정을 명확하게 설명했습니다.', { exact: true })).toBeVisible();
    await memberPage.getByRole('link', { name: '다시 제출하기', exact: true }).click();
    await memberPage.getByLabel('메모 및 질문 (선택)', { exact: true }).fill('검토 후 다시 정리한 실험 과정입니다.');
    await memberPage.getByRole('button', { name: '다시 제출', exact: true }).click();
    const posting = memberPage.waitForResponse(response => response.url().endsWith(`/api/assignments/${assignment.id}/submission`) && response.request().method() === 'POST');
    await memberPage.getByRole('dialog', { name: '과제를 다시 제출할까요?' }).getByRole('button', { name: '제출 확정', exact: true }).click();
    const submitted = await posting;
    expect(submitted.status()).toBe(200);
    expect(await submitted.json()).toMatchObject({ id: submission.id, status: 'PENDING', score: null, feedback: null, reviewedAt: null, reviewedBy: null });
    await expect(memberPage).toHaveURL(`/assignments/${assignment.id}`);
    await expect(memberPage.getByText('93 / 100', { exact: true })).toHaveCount(0);
    await page.reload();
    await page.getByRole('button', { name: '검토 대기', exact: true }).click();
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByRole('button', { name: '검토하기', exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('admin-reviews-mobile.png'), fullPage: true });
    expect(errors).toEqual([]);
  } finally { await memberContext.close(); }
});
