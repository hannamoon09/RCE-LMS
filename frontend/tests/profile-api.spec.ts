import { test, expect, type APIRequestContext } from '@playwright/test';
import { csrf, fixtureName, loginAs, staffStudentId } from './api-helpers';

async function createMember(staff: APIRequestContext) {
  await loginAs(staff, staffStudentId);
  const input = { name: fixtureName('계정 변경 학생'), studentId: `95${Date.now()}${Math.floor(Math.random() * 10000)}`, initialPassword: `Profile-${Date.now()}!` };
  const response = await staff.post('/api/admin/users', { headers: await csrf(staff), data: input });
  expect(response.status()).toBe(201);
  return { ...await response.json(), password: input.initialPassword };
}

test('account name and optional email persist on the server while studentId, FIELD and role remain immutable', async ({ page, context, request }, testInfo) => {
  const member = await createMember(request);
  await loginAs(context.request, member.studentId, member.password);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/settings');
  await expect(page.getByLabel('학번', { exact: true })).toHaveAttribute('readonly', '');
  await expect(page.getByLabel('배정 분야', { exact: true })).toHaveAttribute('readonly', '');
  await expect(page.getByLabel('이름', { exact: true })).toHaveAttribute('maxlength', '100');
  const nextName = fixtureName('서버 저장 이름');
  await page.getByLabel('이름', { exact: true }).fill(nextName);
  await page.getByLabel('이메일', { exact: true }).fill('profile.updated@example.test');
  await page.getByRole('button', { name: '계정 정보 저장', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('계정 정보가 저장되었습니다.');
  await expect(page.locator('[data-desktop-sidebar]')).toContainText(nextName);
  const me = await (await context.request.get('/api/me')).json();
  expect(me).toMatchObject({ name: nextName, email: 'profile.updated@example.test', studentId: member.studentId, role: 'MEMBER', track: 'WEB' });
  for (const extra of [{ studentId: '99999999' }, { role: 'STAFF' }, { track: 'PWN' }, { active: false }, { profileImage: 'not-a-file' }]) {
    expect((await context.request.patch('/api/me', { headers: await csrf(context.request), data: { name: nextName, email: null, ...extra } })).status()).toBe(400);
  }
  await page.reload();
  await expect(page.getByLabel('이름', { exact: true })).toHaveValue(nextName);
  await expect(page.getByLabel('이메일', { exact: true })).toHaveValue('profile.updated@example.test');
  await page.getByLabel('이메일', { exact: true }).fill('');
  await page.getByRole('button', { name: '계정 정보 저장', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('계정 정보가 저장되었습니다.');
  expect((await (await context.request.get('/api/me')).json()).email).toBeNull();
  await page.setViewportSize({ width: 375, height: 812 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('profile-settings-mobile.png'), fullPage: true });
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: nextName, exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('account save failure stays visible, preserves the draft and can be retried', async ({ page, context, request }) => {
  const member = await createMember(request);
  await loginAs(context.request, member.studentId, member.password);
  await page.goto('/settings');
  const name = fixtureName('재시도 계정 이름');
  await page.getByLabel('이름', { exact: true }).fill(name);
  await page.route('**/api/me', async route => {
    if (route.request().method() === 'PATCH') await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: '계정 정보를 저장하지 못했습니다. 다시 시도해 주세요.' }) });
    else await route.continue();
  });
  await page.getByRole('button', { name: '계정 정보 저장', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('계정 정보를 저장하지 못했습니다.');
  await expect(page.getByLabel('이름', { exact: true })).toHaveValue(name);
  expect((await (await context.request.get('/api/me')).json()).name).toBe(member.name);
  await page.unroute('**/api/me');
  await page.getByRole('button', { name: '계정 정보 저장', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('계정 정보가 저장되었습니다.');
  expect((await (await context.request.get('/api/me')).json()).name).toBe(name);
});

test('password change rejects the wrong current password then logs out all old sessions and accepts only the new password', async ({ page, context, request, playwright }, testInfo) => {
  const member = await createMember(request);
  await loginAs(context.request, member.studentId, member.password);
  const secondSession = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await loginAs(secondSession, member.studentId, member.password);
    await page.goto('/settings');
    const nextPassword = `Changed-${Date.now()}!`;
    await page.getByLabel('현재 비밀번호', { exact: true }).fill('Wrong-current-password!');
    await page.getByLabel('새 비밀번호', { exact: true }).fill(nextPassword);
    await page.getByLabel('새 비밀번호 확인', { exact: true }).fill(nextPassword);
    await page.getByRole('button', { name: '비밀번호 변경', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('현재 비밀번호');
    expect((await context.request.get('/api/me')).status()).toBe(200);
    expect((await secondSession.get('/api/me')).status()).toBe(200);
    await page.getByLabel('현재 비밀번호', { exact: true }).fill(member.password);
    await page.getByRole('button', { name: '비밀번호 변경', exact: true }).click();
    await expect(page).toHaveURL('/login?passwordChanged=1');
    await expect(page.getByRole('status')).toContainText('비밀번호가 변경되었습니다.');
    expect((await secondSession.get('/api/me')).status()).toBe(401);
    expect((await context.request.get('/api/me')).status()).toBe(401);
    await page.getByLabel('학번', { exact: true }).fill(member.studentId);
    await page.getByLabel('비밀번호', { exact: true }).fill(member.password);
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL('/login?passwordChanged=1');
    await page.getByLabel('비밀번호', { exact: true }).fill(nextPassword);
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-desktop-sidebar]')).toContainText(member.name);
    expect(errors).toEqual([]);
  } finally { await secondSession.dispose(); }
});
