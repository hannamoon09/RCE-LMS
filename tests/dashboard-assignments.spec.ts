import { test, expect, type Page } from '@playwright/test';
import { initialState, isLMSState, type LMSState } from '../src/data/lmsData';

const now = new Date('2026-09-29T03:00:00.000Z');

async function seed(page: Page, state: LMSState) {
  expect(isLMSState(state)).toBe(true);
  // Start at a known date and let time advance so Anime.js navigation can finish.
  await page.clock.install({ time: now });
  await page.addInitScript(value => {
    sessionStorage.setItem('rce-lms-auth-v1', JSON.stringify({ userId: 'hanna' }));
    if (!localStorage.getItem('rce-lms-demo-v1')) localStorage.setItem('rce-lms-demo-v1', JSON.stringify(value));
  }, state);
}

test('upcoming assignments precede a separate overdue list, using deadline time and excluding submissions', async ({ page }) => {
  const state = structuredClone(initialState);
  const deadlines: Record<string, string> = {
    'web-03': '2026-09-29T07:00:00.000Z',
    'sys-02': '2026-09-29T03:30:00.000Z', // Already submitted: exclude even though near its deadline.
    'net-01': '2026-09-25T03:00:00.000Z',
    'web-02': '2026-09-28T03:00:00.000Z', // Already submitted: exclude from overdue too.
    'sys-03': '2026-09-29T13:00:00.000+09:00',
    'net-02': new Date(now.getTime() + 60000).toISOString(),
    'pwn-03': '2026-09-29T02:59:59.999Z',
    'rev-02': '2026-09-29T05:00:00.000Z',
  };
  state.assignments.forEach(assignment => { assignment.deadline = deadlines[assignment.id]; });
  await seed(page, state);
  await page.goto('/dashboard');

  const upcoming = page.getByRole('region', { name: '다음 과제', exact: true });
  const overdue = page.getByRole('region', { name: '기한 지난 과제', exact: true });
  await expect(upcoming.getByRole('heading', { level: 2 })).toHaveText('다음 과제4');
  await expect(upcoming.getByRole('heading', { level: 3 })).toHaveText(['TLS Traffic Evidence', 'ELF Binary Analysis', 'Control Flow Reconstruction']);
  await expect(overdue.getByRole('heading', { level: 2 })).toHaveText('기한 지난 과제2');
  await expect(overdue.getByRole('heading', { level: 3 })).toHaveText(['Memory Protection Review', 'Packet Analysis']);
  await expect(upcoming.locator('.assignment-surface')).toHaveCount(1);
  await expect(overdue.locator('.assignment-surface')).toHaveCount(0);
  await expect(upcoming.getByRole('link', { name: /전체 보기/ })).toHaveAttribute('href', '/assignments?status=missing');
  await expect(overdue.getByRole('link', { name: /전체 보기/ })).toHaveAttribute('href', '/assignments?status=missing');
  for (const title of ['Stack Buffer Overflow', 'XSS Write-up']) {
    await expect(upcoming).not.toContainText(title);
    await expect(overdue).not.toContainText(title);
  }
  const positions = await Promise.all([upcoming.boundingBox(), overdue.boundingBox()]);
  expect(positions[0]!.y + positions[0]!.height).toBeLessThan(positions[1]!.y);
});

test('overdue-only data shows a compact empty upcoming group and preserves the closed submission policy', async ({ page }) => {
  const state = structuredClone(initialState);
  state.assignments.forEach((assignment, index) => { assignment.deadline = new Date(now.getTime() - (index + 1) * 3600000).toISOString(); });
  await seed(page, state);
  await page.goto('/dashboard');
  const upcoming = page.getByRole('region', { name: '다음 과제', exact: true });
  const overdue = page.getByRole('region', { name: '기한 지난 과제', exact: true });
  await expect(upcoming).toContainText('예정된 미제출 과제가 없습니다.');
  await expect(upcoming.getByRole('heading', { level: 2 })).toHaveText('다음 과제0');
  await expect(upcoming.locator('.assignment-surface')).toHaveCount(0);
  await expect(overdue.getByRole('heading', { level: 2 })).toHaveText('기한 지난 과제6');
  await expect(overdue.getByRole('heading', { level: 3 })).toHaveText(['SQL Injection', 'Packet Analysis', 'ELF Binary Analysis']);
  await overdue.getByRole('link', { name: /SQL Injection/ }).click();
  await expect(page).toHaveURL('/assignments/web-03');
  await expect(page.getByRole('button', { name: '제출 기간이 종료되었습니다', exact: true })).toBeDisabled();
  await page.goto('/assignments/web-03/submit');
  await expect(page.getByRole('textbox', { name: '메모 및 질문 (선택)' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '제출 마감', exact: true })).toBeDisabled();
});

test('fully submitted assignments show the completed empty state without overdue rows', async ({ page }) => {
  const state = structuredClone(initialState);
  state.assignments.forEach(assignment => { assignment.deadline = new Date(now.getTime() - 3600000).toISOString(); });
  state.submissions = state.assignments.map((assignment, index) => ({
    id: `completed-${index}`, assignmentId: assignment.id, userId: 'hanna', submittedAt: '2026-09-28T03:00:00.000Z',
    files: [], text: '', status: 'pending', score: null, feedback: '',
  }));
  await seed(page, state);
  await page.goto('/dashboard');
  await expect(page.getByRole('region', { name: '다음 과제', exact: true })).toContainText('모든 과제를 제출했습니다');
  await expect(page.getByRole('region', { name: '기한 지난 과제', exact: true })).toHaveCount(0);
  await expect(page.locator('.assignment-surface')).toHaveCount(0);
});

test('an empty assignment collection shows its own empty state without implying completion', async ({ page }) => {
  const state = structuredClone(initialState);
  state.assignments = [];
  state.submissions = [];
  state.activities = [];
  await seed(page, state);
  await page.goto('/dashboard');
  const upcoming = page.getByRole('region', { name: '다음 과제', exact: true });
  await expect(upcoming).toContainText('아직 등록된 과제가 없습니다');
  await expect(upcoming).not.toContainText('모든 과제를 제출했습니다');
  await expect(page.getByRole('region', { name: '기한 지난 과제', exact: true })).toHaveCount(0);
});
