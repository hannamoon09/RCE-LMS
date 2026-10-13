import { test, expect } from '@playwright/test';
import { csrf, fixtureName, loginAs, memberStudentId, staffStudentId } from './api-helpers';

const noticeInput = (title: string) => ({ title, body: '첫 번째 공지 문단입니다.\n\n두 번째 공지 문단입니다.', category: '활동 안내', important: true });

test('notice APIs publish only to the staff track and reject member writes or client-selected tracks', async ({ request, playwright }, testInfo) => {
  await loginAs(request, staffStudentId);
  const member = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
  const other = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
  let noticeId: string | undefined;
  try {
    const created = await request.post('/api/admin/notices', { headers: await csrf(request), data: noticeInput(fixtureName('분야 공지 API')) });
    expect(created.status()).toBe(201);
    const notice = await created.json(); noticeId = notice.id;
    expect(notice).toMatchObject({ id: expect.any(String), important: true, category: '활동 안내' });
    await loginAs(member, memberStudentId);
    const list = await member.get('/api/notices');
    expect(list.status()).toBe(200);
    expect(await list.json()).toEqual(expect.arrayContaining([expect.objectContaining({ id: notice.id })]));
    const detail = await member.get(`/api/notices/${notice.id}`);
    expect(detail.status()).toBe(200);
    expect(await detail.json()).toMatchObject({ id: notice.id, body: notice.body });
    await loginAs(other, '20260002');
    expect(await (await other.get('/api/notices')).json()).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: notice.id })]));
    expect((await other.get(`/api/notices/${notice.id}`)).status()).toBe(404);
    expect((await member.post('/api/admin/notices', { headers: await csrf(member), data: noticeInput(fixtureName('회원 공지 금지')) })).status()).toBe(403);
    for (const forged of [{ track: 'PWN' }, { track: null }, { author: 'forged-author' }]) {
      const response = await request.post('/api/admin/notices', { headers: await csrf(request), data: { ...noticeInput(fixtureName('위조 공지 금지')), ...forged } });
      expect(response.status()).toBe(400);
    }
  } finally {
    if (noticeId) expect((await request.delete(`/api/admin/notices/${noticeId}`, { headers: await csrf(request) })).status()).toBe(204);
    await member.dispose(); await other.dispose();
  }
});

test('staff creates, edits and deletes a notice in the existing UI and members read it on desktop and mobile', async ({ page, context, browser }, testInfo) => {
  await loginAs(context.request, staffStudentId);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const title = fixtureName('실제 화면 공지');
  const updatedTitle = `${title} 수정`;
  const memberContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  let noticeId: string | undefined;
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('/notices');
    await page.getByRole('button', { name: '공지 작성', exact: true }).click();
    const create = page.getByRole('dialog', { name: '새 공지 작성', exact: true });
    await create.getByLabel('제목', { exact: true }).fill(title);
    await create.getByLabel('분류', { exact: true }).fill('활동 안내');
    await create.getByLabel('본문', { exact: true }).fill('첫 번째 공지 문단입니다.\n\n두 번째 공지 문단입니다.');
    await create.getByLabel('중요 공지', { exact: true }).check();
    await expect(create.getByRole('combobox')).toHaveCount(0);
    const creating = page.waitForResponse(response => response.url().endsWith('/api/admin/notices') && response.request().method() === 'POST');
    await create.getByRole('button', { name: '공지 등록', exact: true }).click();
    const created = await creating;
    expect(created.status()).toBe(201);
    noticeId = (await created.json()).id;
    await expect(create).not.toBeVisible();
    await page.goto(`/notices/${noticeId}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await page.screenshot({ path: testInfo.outputPath('notice-staff-detail.png'), fullPage: true });

    await loginAs(memberContext.request, memberStudentId);
    const memberPage = await memberContext.newPage();
    memberPage.on('pageerror', error => errors.push(error.message));
    await memberPage.goto('/notices');
    await expect(memberPage.getByRole('button', { name: '공지 작성', exact: true })).toHaveCount(0);
    await memberPage.getByRole('searchbox', { name: '공지 검색', exact: true }).fill(title);
    await memberPage.getByRole('button', { name: '중요 공지', exact: true }).click();
    await memberPage.getByRole('heading', { name: title, exact: true }).click();
    await expect(memberPage).toHaveURL(`/notices/${noticeId}`);
    await expect(memberPage.getByText('첫 번째 공지 문단입니다.', { exact: true })).toBeVisible();
    await expect(memberPage.getByText('두 번째 공지 문단입니다.', { exact: true })).toBeVisible();
    await expect(memberPage.getByRole('button', { name: '공지 수정', exact: true })).toHaveCount(0);
    await expect(memberPage.getByRole('button', { name: '공지 삭제', exact: true })).toHaveCount(0);
    await memberPage.setViewportSize({ width: 375, height: 812 });
    await expect.poll(() => memberPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await memberPage.screenshot({ path: testInfo.outputPath('notice-member-mobile.png'), fullPage: true });

    await page.getByRole('button', { name: '공지 수정', exact: true }).click();
    const edit = page.getByRole('dialog', { name: '공지 수정', exact: true });
    await edit.getByLabel('제목', { exact: true }).fill(updatedTitle);
    await edit.getByLabel('본문', { exact: true }).fill('수정한 공지 본문입니다.');
    const editing = page.waitForResponse(response => response.url().endsWith(`/api/admin/notices/${noticeId}`) && response.request().method() === 'PATCH');
    await edit.getByRole('button', { name: '변경 사항 저장', exact: true }).click();
    expect((await editing).status()).toBe(200);
    await expect(edit).not.toBeVisible();
    await memberPage.reload();
    await expect(memberPage.getByRole('heading', { level: 1 })).toHaveText(updatedTitle);
    await expect(memberPage.getByText('수정한 공지 본문입니다.', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: '공지 삭제', exact: true }).click();
    const deleting = page.waitForResponse(response => response.url().endsWith(`/api/admin/notices/${noticeId}`) && response.request().method() === 'DELETE');
    await page.getByRole('dialog', { name: '공지를 삭제할까요?', exact: true }).getByRole('button', { name: '삭제', exact: true }).click();
    expect((await deleting).status()).toBe(204);
    expect((await memberContext.request.get(`/api/notices/${noticeId}`)).status()).toBe(404);
    expect(errors).toEqual([]);
  } finally {
    if (noticeId) expect([204, 404]).toContain((await context.request.delete(`/api/admin/notices/${noticeId}`, { headers: await csrf(context.request) })).status());
    await memberContext.close();
  }
});

test('notice loading errors preserve the application shell and retry loads real server notices', async ({ page, context }) => {
  await loginAs(context.request, staffStudentId);
  let failed = false;
  await page.route('**/api/notices', async route => {
    if (!failed && route.request().method() === 'GET') {
      failed = true;
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'TEMPORARY_UNAVAILABLE', message: '공지 서버가 잠시 응답하지 않습니다.' }) });
    } else await route.continue();
  });
  await page.goto('/notices');
  await expect(page.getByRole('heading', { name: '공지를 불러오지 못했습니다', exact: true })).toBeVisible();
  await expect(page.locator('[data-desktop-sidebar]')).toBeVisible();
  const retry = page.waitForResponse(response => response.url().endsWith('/api/notices') && response.status() === 200);
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await retry;
  await expect(page.getByRole('heading', { name: '공지사항', exact: true })).toBeVisible();
});
