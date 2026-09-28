import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('rce-lms-auth-v1', JSON.stringify({ userId: 'hanna' }));
  });
});
const routes = ['/dashboard', '/assignments', '/assignments/web-03', '/assignments/web-03/submit', '/notices', '/notices/semester', '/submissions', '/rankings', '/profile', '/settings', '/admin', '/admin/assignments', '/admin/submissions', '/admin/users', '/prototypes', '/dashboard/a', '/dashboard/b', '/dashboard/c', '/dashboard/d'];
for (const width of [1440, 1280, 1024, 768, 390, 375]) {
  test(`all routes render without overflow or console errors at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.getByText('화면을 불러오지 못했습니다')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), route).toBeTruthy();
      if (width < 768 && ['/submissions', '/rankings', '/admin/assignments', '/admin/submissions', '/admin/users'].includes(route)) await expect(page.locator('table')).toBeHidden();
    }
    expect(errors).toEqual([]);
  });
}
test('search and combined filters expose a useful empty state', async ({ page }) => {
  await page.goto('/assignments');
  await page.getByRole('searchbox', { name: '과제 검색' }).fill('SQL');
  await expect(page.getByRole('heading', { name: 'SQL Injection' })).toBeVisible();
  await page.getByRole('button', { name: '제출 완료', exact: true }).click();
  await expect(page.getByRole('heading', { name: '조건에 맞는 과제가 없습니다' })).toBeVisible();
  await page.getByRole('button', { name: '필터 초기화' }).click();
  await page.getByRole('button', { name: '제출 완료', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'XSS Write-up' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'SQL Injection' })).toHaveCount(0);
  await expect(page.getByLabel('트랙 필터')).toHaveCount(0);
  await page.goto('/notices');
  await page.getByRole('button', { name: '중요 공지', exact: true }).click();
  await expect(page.getByRole('heading', { name: '이번 주 동아리 활동 시간 안내' })).toHaveCount(0);
});
test('submission, persistence and zero-score review update shared data', async ({ page }) => {
  await page.goto('/assignments/web-03/submit');
  await page.getByRole('button', { name: '제출하기', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('파일');
  await page.getByRole('textbox', { name: '메모 및 질문 (선택)' }).fill('분석 결과와 개선 방안을 정리했습니다.');
  await page.getByLabel('제출 파일 선택').setInputFiles({ name: 'writeup.md', mimeType: 'text/markdown', buffer: Buffer.from('# Submission') });
  await expect(page.getByText('writeup.md', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '제출하기', exact: true }).click();
  await page.getByRole('button', { name: '제출 확정' }).click();
  await expect(page).toHaveURL('/assignments/web-03');
  await expect(page.getByText('분석 결과와 개선 방안을 정리했습니다.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('writeup.md', { exact: true })).toBeVisible();
  await page.goto('/admin/submissions');
  const row = page.locator('tr').filter({ hasText: 'Hanna' }).filter({ hasText: 'SQL Injection' });
  await row.getByRole('button', { name: '검토하기' }).click();
  await page.getByLabel('점수 / 100').fill('0');
  await page.getByLabel('피드백', { exact: true }).fill('재현 과정의 근거를 보완해 주세요.');
  await page.getByRole('button', { name: '검토 저장' }).click();
  await expect(row).toContainText('검토 완료');
  await page.goto('/assignments/web-03');
  await expect(page.getByText('0 / 100', { exact: true })).toBeVisible();
  await expect(page.getByText('재현 과정의 근거를 보완해 주세요.', { exact: true })).toBeVisible();
  await page.goto('/dashboard');
  await expect(page.locator('[data-summary="submitted"]')).toContainText('3');
  await expect(page.getByRole('progressbar')).toHaveCount(0);
});
test('admin assignment create edit delete and stale URL state', async ({ page }) => {
  await page.goto('/admin/assignments');
  await page.getByRole('button', { name: '과제 생성', exact: true }).click();
  await page.getByLabel('과제명', { exact: true }).fill('QA Integration Lab');
  await page.getByLabel('과제 설명').fill('통합 실습 과제 설명입니다.');
  await page.getByRole('dialog').getByRole('button', { name: '과제 생성', exact: true }).click();
  const row = page.locator('tr').filter({ hasText: 'QA Integration Lab' });
  await expect(row).toBeVisible();
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem('rce-lms-demo-v1')!).assignments.find((a: {title:string}) => a.title === 'QA Integration Lab').id);
  await row.getByRole('button', { name: 'QA Integration Lab 수정' }).click();
  await page.getByLabel('과제명', { exact: true }).fill('QA Updated Lab');
  await page.getByRole('button', { name: '변경 사항 저장' }).click();
  const updated = page.locator('tr').filter({ hasText: 'QA Updated Lab' });
  await expect(updated).toBeVisible();
  await updated.getByRole('button', { name: 'QA Updated Lab 삭제' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click();
  await expect(updated).toHaveCount(0);
  await page.goto(`/assignments/${id}`);
  await expect(page.getByRole('heading', { name: '요청한 항목을 찾을 수 없습니다' })).toBeVisible();
});
test('account, notifications, password validation and member role changes', async ({ page }) => {
  await page.goto('/settings');
  await page.getByLabel('이름', { exact: true }).fill('Hanna QA');
  await page.getByRole('button', { name: '계정 정보 저장' }).click();
  await page.getByRole('switch', { name: '이메일 수신' }).click();
  await page.getByRole('button', { name: '알림 설정 저장' }).click();
  await page.reload();
  await expect(page.getByRole('switch', { name: '이메일 수신' })).toHaveAttribute('aria-checked', 'true');
  await page.getByLabel('현재 비밀번호', { exact: true }).fill('password-before');
  await page.getByLabel('새 비밀번호', { exact: true }).fill('password-after');
  await page.getByLabel('새 비밀번호 확인', { exact: true }).fill('mismatch');
  await page.getByRole('button', { name: '비밀번호 변경 검증' }).click();
  await expect(page.getByRole('alert')).toContainText('일치하지');
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Hanna QA', exact: true })).toBeVisible();
  await page.goto('/admin/users');
  await page.getByRole('combobox', { name: '박민서 역할' }).selectOption('staff');
  await page.reload();
  await expect(page.getByRole('combobox', { name: '박민서 역할' })).toHaveValue('staff');
});
test('persistent sidebar, fast Back, query focus and motion preference', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/dashboard');
  await page.locator('[data-desktop-sidebar]').evaluate(el => el.setAttribute('data-persistent', 'true'));
  await page.getByRole('navigation', { name: '주 메뉴', exact: true }).getByRole('link', { name: '과제', exact: true }).click();
  await expect(page).toHaveURL('/assignments');
  await page.goBack();
  await expect(page.locator('h1')).toHaveText('Hanna');
  await expect(page.locator('[data-page-transition]')).toHaveCSS('opacity', '1');
  await expect(page.locator('[data-desktop-sidebar]')).toHaveAttribute('data-persistent', 'true');
  await page.getByRole('navigation', { name: '주 메뉴', exact: true }).getByRole('link', { name: '과제', exact: true }).click();
  await page.getByRole('searchbox', { name: '과제 검색' }).fill('SQL');
  await expect(page.getByRole('searchbox', { name: '과제 검색' })).toBeFocused();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByRole('searchbox', { name: '과제 검색' })).toBeFocused();
  await page.getByRole('navigation', { name: '주 메뉴', exact: true }).getByRole('link', { name: '설정', exact: true }).click();
  await expect(page.getByRole('heading', { name: '설정', exact: true })).toBeVisible();
});
test('mobile drawer closes after motion, traps focus and supports reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  const trigger = page.getByRole('button', { name: '메뉴 열기' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '메뉴', exact: true });
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.activeElement?.closest('dialog') !== null)).toBeTruthy();
  for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.closest('dialog') !== null)).toBeTruthy();
  await dialog.getByRole('button', { name: '메뉴 닫기' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await trigger.click();
  await dialog.getByRole('link', { name: '과제', exact: true }).click();
  await expect(page).toHaveURL('/assignments');
  await expect(dialog).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await trigger.click();
  await dialog.getByRole('button', { name: '메뉴 닫기' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});

test('reduced motion keeps all route content visible and counters final', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator('h1')).toBeVisible();
    const hidden = await page.locator('[data-reveal], .motion-panel').evaluateAll(elements => elements.filter(el => getComputedStyle(el).opacity === '0').length);
    expect(hidden, route).toBe(0);
  }
  await page.goto('/dashboard');
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await expect(page.locator('[data-summary="total"]')).toContainText('8');
  await expect(page.locator('[data-summary="submitted"]')).toContainText('2');
  await expect(page.locator('[data-summary="missing"]')).toContainText('6');
});
test('file validation, remove, drag-drop and expired submissions', async ({ page }) => {
  await page.goto('/assignments/web-03/submit');
  const input = page.getByLabel('제출 파일 선택');
  await input.setInputFiles({ name: 'bad.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('bad') });
  await expect(page.getByRole('alert')).toContainText('지원하지 않는 형식');
  await input.setInputFiles({ name: 'big.zip', mimeType: 'application/zip', buffer: Buffer.alloc(11 * 1024 * 1024) });
  await expect(page.getByRole('alert')).toContainText('10MB를 초과');
  const data = await page.evaluateHandle(() => { const dt = new DataTransfer(); dt.items.add(new File(['hello'], 'drop.md', { type: 'text/markdown' })); return dt; });
  const dropzone = page.getByRole('button', { name: /파일을 드래그하거나 클릭하여 선택/ });
  await dropzone.dispatchEvent('dragenter', { dataTransfer: data });
  await dropzone.dispatchEvent('drop', { dataTransfer: data });
  await expect(page.getByText('drop.md', { exact: true })).toBeVisible();
  await input.setInputFiles({ name: 'drop.md', mimeType: 'text/markdown', buffer: Buffer.from('duplicate') });
  await expect(page.getByRole('alert')).toContainText('이미 추가된 파일');
  await page.getByRole('button', { name: 'drop.md 제거' }).click();
  await expect(page.getByText('drop.md', { exact: true })).toHaveCount(0);
  await page.goto('/assignments/web-02/submit');
  await expect(page.getByRole('button', { name: '제출 마감', exact: true })).toBeDisabled();
});
test('browser state corruption recovers and admin query state survives refresh', async ({ page }) => {
  await page.goto('/dashboard');
  await page.evaluate(() => localStorage.setItem('rce-lms-demo-v1', '{invalid-json'));
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Hanna');
  await page.goto('/admin/submissions?status=pending');
  await page.getByRole('button', { name: '검토 완료', exact: true }).click();
  await expect(page).toHaveURL(/status=reviewed/);
  await page.reload();
  await expect(page.getByRole('button', { name: '검토 완료', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/admin/submissions?submission=sub-1');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Hanna · 제출 검토 닫기' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).not.toHaveURL(/submission=/);
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
