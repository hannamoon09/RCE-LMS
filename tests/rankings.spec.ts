import { test, expect, type Locator, type Page } from '@playwright/test';
import { initialState, isLMSState, tracks, type LMSState, type Submission } from '../src/data/lmsData';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
});

async function seed(page: Page, state: LMSState = structuredClone(initialState)) {
  expect(isLMSState(state)).toBe(true);
  await page.addInitScript(value => {
    sessionStorage.setItem('rce-lms-auth-v1', JSON.stringify({ userId: 'hanna' }));
    if (!localStorage.getItem('rce-lms-demo-v1')) localStorage.setItem('rce-lms-demo-v1', JSON.stringify(value));
  }, state);
}

function menu(page: Page) { return page.getByRole('navigation', { name: '주 메뉴', exact: true }); }
function table(page: Page) { return page.getByRole('table', { name: '분야 순위', exact: true }); }
function row(page: Page, userId: string) { return table(page).locator(`[data-ranking-user="${userId}"]`); }

async function expectScores(target: Locator, rank: number, total: number, average: string, reviewed: number) {
  const cells = target.getByRole('cell');
  await expect(cells.nth(0)).toHaveText(new RegExp(`^0?${rank}$`));
  await expect(cells.nth(2)).toHaveText(String(total));
  await expect(cells.nth(3)).toHaveText(average);
  await expect(cells.nth(4)).toHaveText(`${reviewed}개`);
}

function submission(id: string, userId: string, score: number | null, submittedAt: string, assignmentId = 'web-02'): Submission {
  return { id, userId, assignmentId, submittedAt, files: [], text: '', status: score === null ? 'pending' : 'reviewed', score, feedback: score === null ? '' : '검토 완료' };
}

for (const track of tracks) {
  test(`${track} member only sees their field, including with a forged track query`, async ({ page }) => {
    const state = structuredClone(initialState);
    Object.assign(state.users.find(user => user.id === 'hanna')!, { role: 'member', track });
    await seed(page, state);
    const otherTrack = tracks.find(candidate => candidate !== track)!;
    await page.goto(`/rankings?track=${encodeURIComponent(otherTrack)}`);
    await expect(page.getByRole('heading', { level: 1, name: '분야 순위', exact: true })).toBeVisible();
    await expect(menu(page).getByRole('link', { name: '순위', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('group', { name: '순위 분야', exact: true })).toHaveCount(0);
    await expect(table(page).locator('tbody tr')).toHaveCount(state.users.filter(user => user.track === track).length);
    for (const user of state.users) {
      await expect(row(page, user.id)).toHaveCount(user.track === track ? 1 : 0);
      // The leaderboard exposes neither email addresses nor full student IDs, even for its own field.
      await expect(page.getByRole('main')).not.toContainText(user.email);
      await expect(page.getByRole('main')).not.toContainText(user.studentId);
    }
    await expect(row(page, 'hanna').getByText('나', { exact: true })).toBeVisible();
    await expectScores(row(page, 'hanna'), 1, 94, '94.0', 1);
    await page.reload();
    await expect(table(page).locator('tbody tr')).toHaveCount(state.users.filter(user => user.track === track).length);
    for (const user of state.users.filter(user => user.track !== track)) await expect(row(page, user.id)).toHaveCount(0);
  });
}

test('staff switches all four fields with a keyboard and preserves the selected field after refresh', async ({ page }) => {
  await seed(page);
  await page.goto('/rankings');
  const filters = page.getByRole('group', { name: '순위 분야', exact: true });
  await expect(filters.getByRole('button')).toHaveText([...tracks]);
  await expect(table(page).getByRole('columnheader')).toHaveText(['순위', '학생', '총점', '평균', '채점 완료']);
  for (const track of tracks) {
    const button = filters.getByRole('button', { name: track, exact: true });
    await button.focus();
    await button.press('Enter');
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    const users = initialState.users.filter(user => user.track === track);
    await expect(table(page).locator('tbody tr')).toHaveCount(users.length);
    for (const user of users) await expect(row(page, user.id)).toBeVisible();
  }
  await expect(page).toHaveURL(url => url.searchParams.get('track') === '포렌식');
  await page.reload();
  await expect(filters.getByRole('button', { name: '포렌식', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expectScores(row(page, 'seojun'), 1, 70, '70.0', 1);
});

test('editing an existing review reorders the leaderboard and updates dashboard and profile from submissions', async ({ page }) => {
  await seed(page);
  await page.goto('/rankings');
  await expectScores(row(page, 'hanna'), 1, 94, '94.0', 1);
  await expectScores(row(page, 'minseo'), 2, 88, '88.0', 1);

  await page.goto('/admin/submissions');
  const reviewRow = page.getByRole('row').filter({ hasText: 'Hanna' }).filter({ hasText: 'XSS Write-up' });
  await reviewRow.getByRole('button', { name: '피드백 수정', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Hanna · 제출 검토', exact: true });
  await dialog.getByLabel('점수 / 100', { exact: true }).fill('70');
  await dialog.getByLabel('피드백', { exact: true }).fill('추가 검토를 반영하여 점수를 수정했습니다.');
  await dialog.getByRole('button', { name: '검토 저장', exact: true }).click();
  await expect(dialog).toBeHidden();
  await menu(page).getByRole('link', { name: '순위', exact: true }).click();
  await expectScores(row(page, 'hanna'), 2, 70, '70.0', 1);
  await expectScores(row(page, 'minseo'), 1, 88, '88.0', 1);
  await expect(table(page).locator('tbody tr').first()).toHaveAttribute('data-ranking-user', 'minseo');

  await menu(page).getByRole('link', { name: '대시보드', exact: true }).click();
  const preview = page.locator('[data-ranking-preview]');
  await expect(preview.locator('[data-ranking-rank]')).toHaveText('02위');
  await expect(preview.locator('[data-ranking-total]')).toHaveText('70');
  await expect(preview.locator('[data-ranking-average]')).toHaveText('70.0');
  await expect(preview.getByRole('link', { name: /전체 보기/ })).toHaveAttribute('href', '/rankings');
  await menu(page).getByRole('link', { name: '프로필', exact: true }).click();
  const profile = page.locator('[data-ranking-profile]');
  await expect(profile.locator('[data-ranking-stat="rank"]')).toHaveText('2위');
  await expect(profile.locator('[data-ranking-stat="total"]')).toHaveText('70');
  await expect(profile.locator('[data-ranking-stat="average"]')).toHaveText('70.0');
  await expect(profile.locator('[data-ranking-stat="reviewed"]')).toHaveText('1');
  await page.goto('/rankings');
  await expectScores(row(page, 'hanna'), 2, 70, '70.0', 1);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('rce-lms-demo-v1')!)) as LMSState;
  expect(saved.submissions.find(item => item.id === 'sub-2')).toMatchObject({ status: 'reviewed', score: 70 });
  expect(Object.keys(saved).sort()).toEqual(Object.keys(initialState).sort());
});

test('a latest pending submission defers the old score while reviewed zero remains a real ranked score', async ({ page }) => {
  const state = structuredClone(initialState);
  state.submissions = [
    submission('hanna-old', 'hanna', 100, '2026-09-01T10:00:00.000Z'),
    submission('hanna-new', 'hanna', null, '2026-09-02T10:00:00.000Z'),
    submission('minseo-zero', 'minseo', 0, '2026-09-01T10:00:00.000Z'),
  ];
  await seed(page, state);
  await page.goto('/rankings');
  await expectScores(row(page, 'minseo'), 1, 0, '0.0', 1);
  const ungraded = row(page, 'hanna');
  await expect(ungraded.getByRole('cell').nth(0)).toHaveText('—');
  await expect(ungraded.getByRole('cell').nth(2)).toContainText('—');
  await expect(ungraded.getByRole('cell').nth(3)).toHaveText('—');
  await expect(ungraded.getByRole('cell').nth(4)).toHaveText('0개');
  await expect(ungraded).toContainText('미채점');
  await expect(table(page).locator('tbody tr').first()).toHaveAttribute('data-ranking-user', 'minseo');
  await expect(ungraded).not.toContainText('100');
});

test('long rankings retain every student and make a lower own rank available in the summary', async ({ page }) => {
  const state = structuredClone(initialState);
  state.submissions = [submission('own-score', 'hanna', 1, '2026-09-01T10:00:00.000Z')];
  const template = state.users.find(user => user.id === 'minseo')!;
  for (let index = 0; index < 14; index++) {
    const id = `rank-student-${index}`;
    state.users.push({ ...template, id, name: `테스트 학생 ${index + 1}`, studentId: `2099${String(index).padStart(4, '0')}`, email: `${id}@rce.example` });
    state.submissions.push(submission(`rank-score-${index}`, id, 100 - index, '2026-09-01T10:00:00.000Z'));
  }
  await seed(page, state);
  await page.goto('/rankings');
  await expect(table(page).locator('tbody tr')).toHaveCount(16);
  await expectScores(row(page, 'hanna'), 15, 1, '1.0', 1);
  await expect(row(page, 'hanna').getByText('나', { exact: true })).toBeVisible();
  await expect(page.locator('[data-ranking-summary]')).toContainText('15');
});

test('mobile rankings use compact rows and finish filter motion under reduced motion', async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/rankings');
  await expect(page.getByRole('heading', { level: 1, name: '분야 순위', exact: true })).toBeVisible();
  await expect(page.locator('table')).toBeHidden();
  const own = page.locator('article[data-ranking-user="hanna"]');
  await expect(own).toBeVisible();
  await expect(own).toContainText('Hanna');
  await expect(own).toContainText('94.0');
  await expect(own.getByText('나', { exact: true })).toBeVisible();
  const filters = page.getByRole('group', { name: '순위 분야', exact: true });
  await filters.getByRole('button', { name: '리버싱', exact: true }).click();
  const ungraded = page.locator('article[data-ranking-user="yujin"]');
  await expect(ungraded).toBeVisible();
  await expect(ungraded).toContainText('미채점');
  await expect(own).toHaveCount(0);
  await expect(ungraded).toHaveCSS('opacity', '1');
  await expect(ungraded).toHaveCSS('translate', 'none');
  await expect(page.locator('[data-page-transition]')).toHaveCSS('opacity', '1');
  await expect(page.locator('[data-title-part]')).toHaveCSS('transform', 'none');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});
