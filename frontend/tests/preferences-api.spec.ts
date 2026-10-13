import { test, expect, type APIRequestContext } from '@playwright/test';
import { csrf, fixtureName, loginAs, staffStudentId } from './api-helpers';

async function member(staff: APIRequestContext) {
  await loginAs(staff, staffStudentId);
  const input = { name: fixtureName('설정 학생'), studentId: `96${Date.now()}${Math.floor(Math.random() * 10000)}`, initialPassword: `Preferences-${Date.now()}!` };
  const response = await staff.post('/api/admin/users', { headers: await csrf(staff), data: input });
  expect(response.status()).toBe(201);
  return { ...await response.json(), password: input.initialPassword };
}
const defaults = { assignment: true, notice: true, feedback: true, email: false };

test('four settings persist across reload and a new session without affecting another account', async ({ page, context, request, playwright }, testInfo) => {
  const user = await member(request);
  const other = await member(request);
  await loginAs(context.request, user.studentId, user.password);
  await page.goto('/settings');
  for (const label of ['과제 알림', '공지 알림', '피드백 알림']) await expect(page.getByRole('switch', { name: label, exact: true })).toBeChecked();
  await expect(page.getByRole('switch', { name: '이메일 수신', exact: true })).not.toBeChecked();
  for (const label of ['과제 알림', '공지 알림', '피드백 알림', '이메일 수신']) await page.getByRole('switch', { name: label, exact: true }).click();
  await page.getByRole('button', { name: '알림 설정 저장', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('알림 설정이 저장되었습니다.');
  const values = { assignment: false, notice: false, feedback: false, email: true };
  expect(await (await context.request.get('/api/me/preferences')).json()).toEqual(values);
  await page.reload();
  for (const label of ['과제 알림', '공지 알림', '피드백 알림']) await expect(page.getByRole('switch', { name: label, exact: true })).not.toBeChecked();
  await expect(page.getByRole('switch', { name: '이메일 수신', exact: true })).toBeChecked();
  await page.setViewportSize({ width: 375, height: 812 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('preferences-mobile.png'), fullPage: true });
  const fresh = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
  try {
    await loginAs(fresh, user.studentId, user.password);
    expect(await (await fresh.get('/api/me/preferences')).json()).toEqual(values);
    await loginAs(fresh, other.studentId, other.password);
    expect(await (await fresh.get('/api/me/preferences')).json()).toEqual(defaults);
  } finally { await fresh.dispose(); }
});

test('load and save failures preserve useful retry controls and unsaved choices', async ({ page, context, request }) => {
  const user = await member(request);
  await loginAs(context.request, user.studentId, user.password);
  await page.route('**/api/me/preferences', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: '알림 설정을 불러오지 못했습니다.' }) }));
  await page.goto('/settings');
  await expect(page.getByRole('alert')).toContainText('알림 설정을 불러오지 못했습니다.');
  await expect(page.getByRole('button', { name: '계정 정보 저장', exact: true })).toBeVisible();
  await page.unroute('**/api/me/preferences');
  await page.getByRole('button', { name: '알림 설정 다시 불러오기', exact: true }).click();
  const email = page.getByRole('switch', { name: '이메일 수신', exact: true });
  await expect(email).not.toBeChecked();
  await email.click();
  await page.route('**/api/me/preferences', async route => {
    if (route.request().method() === 'PATCH') await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: '알림 설정을 저장하지 못했습니다.' }) });
    else await route.continue();
  });
  await page.getByRole('button', { name: '알림 설정 저장', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('알림 설정을 저장하지 못했습니다.');
  await expect(email).toBeChecked();
  expect(await (await context.request.get('/api/me/preferences')).json()).toEqual(defaults);
  await page.unroute('**/api/me/preferences');
  await page.getByRole('button', { name: '알림 설정 저장', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('알림 설정이 저장되었습니다.');
  expect(await (await context.request.get('/api/me/preferences')).json()).toEqual({ ...defaults, email: true });
});
