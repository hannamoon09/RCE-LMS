import { test, expect, type Locator, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    sessionStorage.setItem('rce-lms-auth-v1', JSON.stringify({ userId: 'hanna' }));
  });
});

async function settledTitle(page: Page, title: string) {
  const heading = page.getByRole('heading', { level: 1, name: title, exact: true });
  await expect(heading).toBeVisible();
  await expect(heading).toHaveText(title);
  await expect(heading.locator('[data-title-part]')).toHaveCount(1);
  await expect.poll(() => heading.locator('[data-title-part]').evaluateAll(parts =>
    parts.length > 0 && parts.every(part => {
      const style = getComputedStyle(part);
      return style.opacity === '1' && style.transform === 'none';
    }),
  )).toBe(true);
  return heading;
}

async function settledList(list: Locator) {
  await expect.poll(() => list.evaluate(container => {
    const items = container.querySelectorAll<HTMLElement>('[data-list-item], [data-list-empty]');
    const candidates = items.length ? Array.from(items) : Array.from(container.children) as HTMLElement[];
    return candidates.length > 0 && candidates.every(item => {
      const style = getComputedStyle(item);
      return style.opacity === '1' && style.translate === 'none';
    });
  })).toBe(true);
}

function menu(page: Page) { return page.getByRole('navigation', { name: '주 메뉴', exact: true }); }

test('titles stay whole and only the workspace receives ambient silver depth', async ({ page }) => {
  for (const [route, title, documentTitle] of [
    ['/dashboard', 'Hanna', '대시보드'],
    ['/assignments', '과제', '과제'],
    ['/assignments/web-03', 'SQL Injection', 'SQL Injection'],
  ]) {
    await page.goto(route);
    const heading = page.getByRole('heading', { level: 1, name: title, exact: true });
    // A complete sentence is present from the first render, with no character or word stagger.
    await expect(heading).toHaveText(title);
    await expect(heading.locator('[data-title-part]')).toHaveCount(1);
    await expect(heading.locator('[data-title-part]')).toHaveText(title);
    await expect(heading.locator('[data-title-part]')).toHaveCSS('background-image', 'none');
    await expect(heading.locator('[data-title-visual]')).toHaveAttribute('aria-hidden', 'true');
    await expect(heading).toHaveAccessibleName(title);
    await settledTitle(page, title);
    await expect(page).toHaveTitle(`${documentTitle} · RCE LMS`);
  }
  await expect(page.locator('.app-workspace')).toHaveCSS('background-image', /radial-gradient.*linear-gradient/);
  await expect(page.locator('.app-workspace')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('[data-desktop-sidebar]')).toHaveCSS('background-image', 'none');
  await page.goto('/dashboard');
  await expect(page.locator('[data-summary="total"]')).toHaveCSS('background-image', 'none');

  const publicPage = await page.context().newPage();
  try {
    for (const route of ['/', '/login']) {
      await publicPage.goto(route);
      await expect(publicPage.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(publicPage.locator('.app-workspace, [data-page-title]')).toHaveCount(0);
      expect(await publicPage.getByRole('main').evaluate(main => getComputedStyle(main).getPropertyValue('--workspace-light-opacity').trim())).toBe('');
    }
  } finally { await publicPage.close(); }
});

test('search and query filters retain focus without replaying the title or page transition', async ({ page }) => {
  await page.goto('/assignments');
  const heading = await settledTitle(page, '과제');
  await expect(page.locator('[data-page-transition]')).toHaveCSS('opacity', '1');
  const audit = await page.evaluateHandle(() => {
    const heading = document.querySelector('[data-page-title]')!;
    let mutations = 0;
    const observer = new MutationObserver(records => { mutations += records.length; });
    observer.observe(heading, { subtree: true, attributes: true, attributeFilter: ['style'], characterData: true, childList: true });
    observer.observe(document.querySelector('[data-page-transition]')!, { attributes: true, attributeFilter: ['style'] });
    return { heading, count: () => mutations, disconnect: () => observer.disconnect() };
  });
  const search = page.getByRole('searchbox', { name: '과제 검색' });
  await search.fill('SQL');
  await expect(search).toBeFocused();
  await expect(page.getByRole('heading', { name: 'SQL Injection', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '제출 완료', exact: true }).click();
  await expect(page.getByRole('heading', { name: '조건에 맞는 과제가 없습니다', exact: true })).toBeVisible();
  await search.fill('XSS');
  await expect(search).toBeFocused();
  await expect(page.getByRole('heading', { name: 'XSS Write-up', exact: true })).toBeVisible();
  await settledList(page.locator('[data-list-transition]'));
  await expect(heading).toHaveText('과제');
  expect(await audit.evaluate(state => ({ same: state.heading === document.querySelector('[data-page-title]'), mutations: state.count() }))).toEqual({ same: true, mutations: 0 });
  await audit.evaluate(state => state.disconnect());
  await audit.dispose();
});

test('rapid navigation and Back leave the persistent sidebar and final page usable', async ({ page }) => {
  await page.goto('/dashboard');
  await settledTitle(page, 'Hanna');
  const sidebar = await page.locator('[data-desktop-sidebar]').elementHandle();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  // Native link clicks in one task deliberately interrupt the outgoing page before its exit finishes.
  await menu(page).evaluate(nav => {
    (nav.querySelector('a[href="/assignments"]') as HTMLAnchorElement).click();
    (nav.querySelector('a[href="/notices"]') as HTMLAnchorElement).click();
    (nav.querySelector('a[href="/settings"]') as HTMLAnchorElement).click();
  });
  await expect(page).toHaveURL('/settings');
  await settledTitle(page, '설정');
  await page.goBack();
  await settledTitle(page, '공지사항');
  await page.goBack();
  await settledTitle(page, '과제');
  await expect(page.locator('[data-page-transition]')).not.toHaveAttribute('inert');
  await expect(page.locator('[data-page-transition]')).toHaveCSS('opacity', '1');
  expect(await sidebar!.evaluate(element => element === document.querySelector('[data-desktop-sidebar]'))).toBe(true);
  await expect(menu(page).getByRole('link', { name: '과제', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('searchbox', { name: '과제 검색' }).fill('SQL');
  await expect(page.getByRole('searchbox', { name: '과제 검색' })).toBeFocused();
  expect(errors).toEqual([]);
});

test('reduced motion starts fully visible and safely finishes an active title reveal', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/assignments');
  await settledTitle(page, '과제');
  await settledList(page.locator('[data-list-transition]'));
  await expect(page.locator('[data-title-part][style*="opacity"], [data-title-part][style*="transform"]')).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await settledTitle(page, '과제');
  let switchedDuringReveal = false;
  await page.exposeFunction('reduceDuringReveal', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    switchedDuringReveal = true;
  });
  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      const parts = document.querySelectorAll<HTMLElement>('[data-page-title][aria-label="설정"] [data-title-part]');
      if (!Array.from(parts).some(part => part.style.opacity !== '' && Number(part.style.opacity) < 1)) return;
      observer.disconnect();
      void (window as typeof window & { reduceDuringReveal: () => Promise<void> }).reduceDuringReveal();
    });
    observer.observe(document.querySelector('main')!, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
  });
  await menu(page).getByRole('link', { name: '설정', exact: true }).click();
  await expect.poll(() => switchedDuringReveal).toBe(true);
  await settledTitle(page, '설정');
  await expect(page.locator('[data-page-transition]')).toHaveCSS('opacity', '1');
  await expect(page.locator('[data-page-transition]')).not.toHaveAttribute('inert');
  await expect(page.locator('[data-title-part][style*="opacity"], [data-title-part][style*="transform"]')).toHaveCount(0);
  await menu(page).getByRole('link', { name: '과제', exact: true }).click();
  await page.getByRole('searchbox', { name: '과제 검색' }).fill('존재하지 않는 과제');
  await expect(page.getByRole('heading', { name: '조건에 맞는 과제가 없습니다' })).toBeVisible();
  await settledList(page.locator('[data-list-transition]'));
  await page.getByRole('button', { name: '필터 초기화' }).click();
  await settledList(page.locator('[data-list-transition]'));
});

test('filtered lists preserve surviving rows and settle after empty states and responsive changes', async ({ page }) => {
  await page.goto('/assignments');
  const list = page.locator('[data-list-transition]');
  await settledList(list);
  const sql = await list.locator('a[href="/assignments/web-03"]').elementHandle();
  const search = page.getByRole('searchbox', { name: '과제 검색' });
  await search.fill('SQL');
  await expect(list.locator('a')).toHaveCount(1);
  expect(await sql!.evaluate(element => element === document.querySelector('[data-list-transition] a[href="/assignments/web-03"]'))).toBe(true);
  await search.fill('존재하지 않는 과제');
  await expect(list.locator('[data-list-empty]')).toBeVisible();
  await search.fill('');
  await expect(list.locator('a')).toHaveCount(8);
  await settledList(list);

  await page.goto('/admin/users');
  const tableList = page.locator('[data-list-transition]');
  await settledList(tableList);
  await page.getByRole('searchbox', { name: '학생 검색' }).fill('Hanna');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await settledList(tableList);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.locator('table')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Hanna', exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: '학생 검색' }).fill('');
  await settledList(tableList);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
