import { test, expect, type Page } from '@playwright/test';
import { csrf, fixtureName, loginAs, staffStudentId } from './api-helpers';

type StoredImage = { id: string; name: string; size: number; type: string };
const editDialog = (page: Page) => page.getByRole('dialog', { name: '프로필 사진 편집', exact: true });

test.beforeEach(async ({ page, context, request }) => {
  await loginAs(request, staffStudentId);
  const input = { name: fixtureName('프로필 학생'), studentId: `94${Date.now()}${Math.floor(Math.random() * 10000)}`, initialPassword: `Profile-${Date.now()}!` };
  const created = await request.post('/api/admin/users', { headers: await csrf(request), data: input });
  expect(created.status()).toBe(201);
  await loginAs(context.request, input.studentId, input.initialPassword);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    const state = window as typeof window & { profileRevokedUrls: string[] };
    state.profileRevokedUrls = [];
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url: string) => { state.profileRevokedUrls.push(url); revoke(url); };
  });
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: '내 프로필', exact: true })).toBeVisible();
});

async function imageFile(page: Page, type = 'image/png', width = 768, height = 512) {
  const base64 = await page.evaluate(({ type, width, height }) => {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d')!;
    ['#ee2244', '#228844', '#2266ee'].forEach((color, index) => { context.fillStyle = color; context.fillRect(index * width / 3, 0, width / 3, height); });
    return canvas.toDataURL(type, 0.95).split(',')[1];
  }, { type, width, height });
  return { name: `profile-fixture.${type === 'image/jpeg' ? 'jpg' : type.split('/')[1]}`, mimeType: type, buffer: Buffer.from(base64, 'base64') };
}

async function choose(page: Page, file: Awaited<ReturnType<typeof imageFile>>) {
  await page.getByRole('button', { name: '사진 변경', exact: true }).focus();
  await page.getByLabel('프로필 이미지 선택', { exact: true }).setInputFiles(file);
}

async function metadata(page: Page): Promise<StoredImage | null> {
  const response = await page.request.get('/api/me');
  expect(response.status()).toBe(200);
  return (await response.json()).profileImage;
}

async function storedBlob(page: Page, id: string) {
  return page.evaluate(async id => {
    const response = await fetch(`/api/files/${encodeURIComponent(id)}`, { credentials: 'include', cache: 'no-store' });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Unexpected file response ${response.status}`);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    const center = Array.from(context.getImageData(Math.floor(bitmap.width / 2), Math.floor(bitmap.height / 2), 1, 1).data);
    const result = { width: bitmap.width, height: bitmap.height, size: blob.size, type: blob.type, center };
    bitmap.close();
    return result;
  }, id);
}

async function expectRevoked(page: Page, url: string) {
  await expect.poll(() => page.evaluate(url => (window as typeof window & { profileRevokedUrls: string[] }).profileRevokedUrls.includes(url), url)).toBe(true);
}

test('profile photo accepts PNG, JPEG and WebP and cancel permits choosing the same file again', async ({ page }) => {
  for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
    const file = await imageFile(page, type, 256, 256);
    await choose(page, file);
    await expect(editDialog(page)).toBeVisible();
    const preview = editDialog(page).getByAltText('저장할 프로필 사진 미리보기');
    await expect(preview).toBeVisible();
    const url = (await preview.getAttribute('src'))!;
    expect(await page.getByLabel('프로필 이미지 선택', { exact: true }).inputValue()).toBe('');
    await editDialog(page).getByRole('button', { name: '취소', exact: true }).click();
    await expect(editDialog(page)).toHaveCount(0);
    await expectRevoked(page, url);
    expect(await metadata(page)).toBeNull();
    await expect(page.getByRole('button', { name: '사진 변경', exact: true })).toBeFocused();
    await choose(page, file);
    await expect(editDialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(editDialog(page)).toHaveCount(0);
  }
});

test('profile photo rejects unsupported types, files over 5MB, and either dimension below 256px', async ({ page }) => {
  await choose(page, { name: 'not-allowed.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"/>') });
  await expect(page.getByRole('alert')).toContainText('PNG, JPG 또는 WebP');
  await expect(editDialog(page)).toHaveCount(0);
  await choose(page, { name: 'too-large.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await expect(page.getByRole('alert')).toContainText('최대 5MB');
  for (const [width, height] of [[255, 300], [300, 255]]) {
    await choose(page, await imageFile(page, 'image/png', width, height));
    await expect(page.getByRole('alert')).toContainText('모두 256px 이상');
    await expect(editDialog(page)).toHaveCount(0);
  }
  expect(await metadata(page)).toBeNull();
});

test('crop supports keyboard pan and zoom, stores a real 512px image, persists across pages, and restores fallback', async ({ page, request, playwright }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await choose(page, await imageFile(page));
  const dialog = editDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('group', { name: '사진 자르기 영역' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByLabel('가로 위치', { exact: true })).toHaveValue('5');
  await dialog.getByLabel('확대', { exact: true }).focus();
  await page.keyboard.press('End');
  await expect(dialog.getByLabel('확대', { exact: true })).toHaveValue('3');
  await dialog.getByLabel('가로 위치', { exact: true }).focus();
  await page.keyboard.press('End');
  await expect(dialog.getByLabel('가로 위치', { exact: true })).toHaveValue('100');
  await dialog.getByRole('button', { name: '사진 저장', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => metadata(page)).not.toBeNull();
  const first = (await metadata(page))!;
  expect(Object.keys(first).sort()).toEqual(['id', 'name', 'size', 'type']);
  expect((await request.get(`/api/files/${first.id}`)).status()).toBe(200);
  const otherTrack = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
  try {
    await loginAs(otherTrack, '20260002');
    expect((await otherTrack.get(`/api/files/${first.id}`)).status()).toBe(404);
  } finally { await otherTrack.dispose(); }
  expect(first).toMatchObject({ name: 'profile.png', type: 'image/png' });
  const saved = await storedBlob(page, first.id);
  expect(saved).toMatchObject({ width: 512, height: 512, type: 'image/png', size: first.size, center: [34, 102, 238, 255] });
  await expect(page.locator('main [data-profile-image]')).toBeVisible();

  await page.reload();
  await expect(page.locator('main [data-profile-image]')).toBeVisible();
  await expect(page.locator('[data-desktop-sidebar] [data-profile-image]')).toBeVisible();
  expect((await metadata(page))!.id).toBe(first.id);
  await page.getByRole('navigation', { name: '주 메뉴', exact: true }).getByRole('link', { name: '대시보드', exact: true }).click();
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('main header [data-profile-image]')).toBeVisible();
  await expect(page.locator('[data-desktop-sidebar] [data-profile-image]')).toBeVisible();

  await page.goto('/profile');
  await choose(page, await imageFile(page, 'image/jpeg'));
  await expect(dialog).toBeVisible();
  const cancelledUrl = (await dialog.getByAltText('저장할 프로필 사진 미리보기').getAttribute('src'))!;
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expectRevoked(page, cancelledUrl);
  expect((await metadata(page))!.id).toBe(first.id);
  expect(await storedBlob(page, first.id)).not.toBeNull();

  await choose(page, await imageFile(page, 'image/webp'));
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '사진 저장', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => (await metadata(page))?.id).not.toBe(first.id);
  const second = (await metadata(page))!;
  await expect.poll(() => storedBlob(page, first.id)).toBeNull();
  await page.getByRole('button', { name: '사진 삭제', exact: true }).click();
  await expect.poll(() => metadata(page)).toBeNull();
  await expect(page.locator('main [data-profile-image]')).toHaveCount(0);
  const name = (await (await page.request.get('/api/me')).json()).name;
  await expect(page.locator('main').getByRole('img', { name: `${name} 기본 프로필`, exact: true })).toBeVisible();
  await expect(page.locator('[data-desktop-sidebar]').getByRole('img', { name: `${name} 기본 프로필`, exact: true })).toBeVisible();
  await expect.poll(() => storedBlob(page, second.id)).toBeNull();
  await page.reload();
  await expect(page.locator('main').getByRole('img', { name: `${name} 기본 프로필`, exact: true })).toBeVisible();
  expect(await metadata(page)).toBeNull();
  expect(errors).toEqual([]);
});

test('profile shows server assignment activity separately, joined date, and account status only in sidebar', async ({ page, request }) => {
  const created = await request.post('/api/admin/assignments', { headers: await csrf(request), data: {
    title: fixtureName('프로필 활동 과제'), description: '프로필 활동 표시 검증', difficulty: 'Low', deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
  } });
  expect(created.status()).toBe(201);
  const assignment = await created.json();
  const submitted = await page.request.post(`/api/assignments/${assignment.id}/submission`, { headers: await csrf(page.request), data: { content: '실습 기록입니다.' } });
  expect(submitted.status()).toBe(200);
  const submission = await submitted.json();
  expect((await request.patch(`/api/admin/submissions/${submission.id}/review`, { headers: await csrf(request), data: { score: 87, feedback: '활동을 확인했습니다.' } })).status()).toBe(200);
  await page.reload();
  const main = page.locator('main');
  const me = await (await page.request.get('/api/me')).json();
  const joined = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul' }).format(new Date(me.joinedAt));
  await expect(main.getByText('가입 날짜', { exact: true })).toBeVisible();
  await expect(main.locator('dl time')).toHaveText(joined);
  await expect(main.getByText('활동 상태', { exact: true })).toHaveCount(0);
  await expect(main.getByText(/^(활성|비활성|활동 중)$/)).toHaveCount(0);
  await expect(page.locator('[data-desktop-sidebar]').getByText('웹해킹 · 활성', { exact: true })).toBeVisible();
  const rows = main.getByRole('list').getByRole('link');
  await expect(rows.filter({ hasText: assignment.title }).filter({ hasText: '제출 완료' })).toBeVisible();
  await expect(rows.filter({ hasText: assignment.title }).filter({ hasText: '피드백 도착' })).toBeVisible();
  await expect(rows.filter({ hasText: '피드백 도착' })).toHaveAttribute('href', `/assignments/${assignment.id}`);
});

test('375px crop dialog stays within the viewport and its controls remain reachable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await choose(page, await imageFile(page));
  const dialog = editDialog(page);
  await expect(dialog).toBeVisible();
  const crop = await dialog.getByRole('group', { name: '사진 자르기 영역' }).boundingBox();
  expect(crop).not.toBeNull();
  expect(crop!.x).toBeGreaterThanOrEqual(0);
  expect(crop!.x + crop!.width).toBeLessThanOrEqual(375);
  expect(Math.abs(crop!.width - crop!.height)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(await dialog.evaluate(element => element.scrollWidth <= innerWidth + 1)).toBe(true);
  await expect(dialog.locator(':scope > div')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: testInfo.outputPath('profile-crop-mobile.png') });
  await dialog.getByLabel('확대', { exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByLabel('확대', { exact: true })).toHaveValue('1.01');
  await dialog.getByRole('button', { name: '사진 저장', exact: true }).scrollIntoViewIfNeeded();
  await expect(dialog.getByRole('button', { name: '사진 저장', exact: true })).toBeInViewport();
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: '사진 변경', exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  await page.screenshot({ path: testInfo.outputPath('profile-mobile.png'), fullPage: true });
});

test('failed server save keeps the previous profile image and allows retry', async ({ page }) => {
  await choose(page, await imageFile(page));
  await editDialog(page).getByRole('button', { name: '사진 저장', exact: true }).click();
  await expect(editDialog(page)).toHaveCount(0);
  const original = (await metadata(page))!;
  await page.route('**/api/me/profile-image', async route => {
    if (route.request().method() === 'POST') await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'STORAGE_UNAVAILABLE', message: '사진을 저장하지 못했습니다. 다시 시도해 주세요.' }) });
    else await route.continue();
  });
  await choose(page, await imageFile(page, 'image/jpeg'));
  await editDialog(page).getByRole('button', { name: '사진 저장', exact: true }).click();
  await expect(editDialog(page).getByRole('alert')).toContainText('저장하지 못했습니다');
  expect(await metadata(page)).toEqual(original);
  expect(await storedBlob(page, original.id)).not.toBeNull();
  await page.unroute('**/api/me/profile-image');
  await editDialog(page).getByRole('button', { name: '사진 저장', exact: true }).click();
  await expect(editDialog(page)).toHaveCount(0);
  await expect.poll(async () => (await metadata(page))?.id).not.toBe(original.id);
  await page.reload();
  await expect(page.locator('main [data-profile-image]')).toBeVisible();
});

test('crop pointer drag, reset and keyboard boundaries stay usable before cancelling', async ({ page }) => {
  await choose(page, await imageFile(page));
  const dialog = editDialog(page);
  const crop = dialog.getByRole('group', { name: '사진 자르기 영역', exact: true });
  const box = (await crop.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 40, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  expect(Number(await dialog.getByLabel('가로 위치', { exact: true }).inputValue())).toBeGreaterThan(0);
  await dialog.getByRole('button', { name: '위치 초기화', exact: true }).click();
  await expect(dialog.getByLabel('가로 위치', { exact: true })).toHaveValue('0');
  await expect(dialog.getByLabel('확대', { exact: true })).toHaveValue('1');
  await crop.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(dialog.getByLabel('가로 위치', { exact: true })).toHaveValue('-5');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: '사진 변경', exact: true })).toBeFocused();
  expect(await metadata(page)).toBeNull();
});
