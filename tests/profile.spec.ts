import { mkdir } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';

type StoredImage = { id: string; name: string; size: number; type: string };
const storageKey = 'rce-lms-demo-v1';
const editDialog = (page: Page) => page.getByRole('dialog', { name: '프로필 사진 편집', exact: true });

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    sessionStorage.setItem('rce-lms-auth-v1', JSON.stringify({ userId: 'hanna' }));
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
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!).users.find((user: { id: string }) => user.id === 'hanna').profileImage, storageKey);
}

async function storedBlob(page: Page, id: string) {
  return page.evaluate(async id => {
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const request = indexedDB.open('rce-lms-files-v1', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('files', 'readonly');
        const read = transaction.objectStore('files').get(id);
        read.onsuccess = () => { resolve(read.result instanceof Blob ? read.result : null); };
        read.onerror = () => reject(read.error);
        transaction.oncomplete = () => database.close();
      };
    });
    if (!blob) return null;
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

test('crop supports keyboard pan and zoom, stores a real 512px image, persists across pages, and restores fallback', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
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
  await expect(page.locator('main').getByRole('img', { name: 'Hanna 기본 프로필', exact: true })).toBeVisible();
  await expect(page.locator('[data-desktop-sidebar]').getByRole('img', { name: 'Hanna 기본 프로필', exact: true })).toBeVisible();
  await expect.poll(() => storedBlob(page, second.id)).toBeNull();
  await page.reload();
  await expect(page.locator('main').getByRole('img', { name: 'Hanna 기본 프로필', exact: true })).toBeVisible();
  expect(await metadata(page)).toBeNull();
  expect(errors).toEqual([]);
});

test('profile shows assignment and activity kind separately, joined date, and account status only in sidebar', async ({ page }) => {
  const main = page.locator('main');
  await expect(main.getByText('가입 날짜', { exact: true })).toBeVisible();
  await expect(main.locator('dl time')).toHaveText(/2024\.\s*03\.\s*04\./);
  await expect(main.getByText('활동 상태', { exact: true })).toHaveCount(0);
  await expect(main.getByText(/^(활성|비활성|활동 중)$/)).toHaveCount(0);
  await expect(page.locator('[data-desktop-sidebar]').getByText('웹해킹 · 활성', { exact: true })).toBeVisible();
  const rows = main.getByRole('list').getByRole('link');
  await expect(rows.filter({ hasText: 'Stack Buffer Overflow' }).filter({ hasText: '제출 완료' })).toBeVisible();
  await expect(rows.filter({ hasText: 'XSS Write-up' }).filter({ hasText: '피드백 도착' })).toBeVisible();
  await expect(rows.filter({ hasText: 'XSS Write-up' }).filter({ hasText: '제출 완료' })).toBeVisible();
  await expect(rows.filter({ hasText: '피드백 도착' })).toHaveAttribute('href', '/assignments/web-02');
});

test('375px crop dialog stays within the viewport and its controls remain reachable', async ({ page }) => {
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
  await mkdir('/tmp/rce-refinement-qa', { recursive: true });
  await page.screenshot({ path: '/tmp/rce-refinement-qa/profile-crop-375.png' });
  await dialog.getByLabel('확대', { exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByLabel('확대', { exact: true })).toHaveValue('1.01');
  await dialog.getByRole('button', { name: '사진 저장', exact: true }).scrollIntoViewIfNeeded();
  await expect(dialog.getByRole('button', { name: '사진 저장', exact: true })).toBeInViewport();
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: '사진 변경', exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  await page.screenshot({ path: '/tmp/rce-refinement-qa/profile-375.png', fullPage: true });
});

test('failed metadata save keeps the previous photo and removes the uncommitted replacement', async ({ page }) => {
  await choose(page, await imageFile(page));
  await editDialog(page).getByRole('button', { name: '사진 저장', exact: true }).click();
  await expect(editDialog(page)).toHaveCount(0);
  const original = (await metadata(page))!;
  await page.evaluate(() => {
    const native = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'rce-lms-demo-v1') throw new DOMException('Simulated quota exceeded', 'QuotaExceededError');
      native.call(this, key, value);
    };
  });
  await choose(page, await imageFile(page, 'image/jpeg'));
  await editDialog(page).getByRole('button', { name: '사진 저장', exact: true }).click();
  await expect(editDialog(page).getByRole('alert')).toContainText('변경하지 못했습니다');
  expect(await metadata(page)).toEqual(original);
  expect(await storedBlob(page, original.id)).not.toBeNull();
  await expect.poll(() => page.evaluate(() => new Promise<string[]>((resolve, reject) => {
    const request = indexedDB.open('rce-lms-files-v1', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('files', 'readonly');
      const keys = transaction.objectStore('files').getAllKeys();
      keys.onsuccess = () => resolve(keys.result as string[]);
      transaction.oncomplete = () => database.close();
    };
  }))).toEqual([original.id]);
  await page.reload();
  expect(await metadata(page)).toEqual(original);
  await expect(page.locator('main [data-profile-image]')).toBeVisible();
});
