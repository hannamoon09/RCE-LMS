import { test, expect } from '@playwright/test';
import { csrf, loginAs } from './api-helpers';
import { createScenario, type Scenario } from './scenario';

let scenario: Scenario;
test.beforeEach(async ({ playwright, context }, testInfo) => {
  scenario = await createScenario(playwright, testInfo.project.use.baseURL);
  await loginAs(context.request, scenario.member.studentId, scenario.member.password);
});
test.afterEach(async () => { await scenario?.dispose(); });

async function deadline(assignment: Awaited<ReturnType<Scenario['createAssignment']>>, value: number) {
  expect((await scenario.staffRequest.patch(`/api/admin/assignments/${assignment.id}`, { headers: await csrf(scenario.staffRequest), data: {
    title: assignment.title, description: assignment.description, difficulty: assignment.difficulty, deadline: new Date(value).toISOString(),
  } })).status()).toBe(200);
}
async function submit(id: string) {
  expect((await scenario.memberRequest.post(`/api/assignments/${id}/submission`, { headers: await csrf(scenario.memberRequest), data: { content: '제출한 실습 기록입니다.' } })).status()).toBe(200);
}

test('upcoming assignments precede a separate overdue list, using deadline time and excluding submissions', async ({ page }) => {
  const now = Date.now();
  const upcomingTitles = ['가장 가까운 실습', '한 시간 뒤 실습', '두 시간 뒤 실습', '네 시간 뒤 실습'];
  for (const [index, minutes] of [10, 60, 120, 240].entries()) await scenario.createAssignment({ title: upcomingTitles[index], deadline: new Date(now + minutes * 60000).toISOString() });
  const overdueRecent = await scenario.createAssignment({ title: '최근 기한 지난 실습' });
  const overdueOld = await scenario.createAssignment({ title: '먼저 기한 지난 실습' });
  await deadline(overdueRecent, now - 3600000); await deadline(overdueOld, now - 4 * 3600000);
  const completedFuture = await scenario.createAssignment({ title: '제출한 예정 실습', deadline: new Date(now + 30 * 60000).toISOString() });
  const completedPast = await scenario.createAssignment({ title: '제출한 지난 실습' });
  await submit(completedFuture.id); await submit(completedPast.id); await deadline(completedPast, now - 2 * 3600000);
  await page.goto('/dashboard');
  const upcoming = page.getByRole('region', { name: '다음 과제', exact: true });
  const overdue = page.getByRole('region', { name: '기한 지난 과제', exact: true });
  await expect(upcoming.getByRole('heading', { level: 2 })).toHaveText('다음 과제4');
  await expect(upcoming.getByRole('heading', { level: 3 })).toHaveText(upcomingTitles.slice(0, 3));
  await expect(overdue.getByRole('heading', { level: 2 })).toHaveText('기한 지난 과제2');
  await expect(overdue.getByRole('heading', { level: 3 })).toHaveText([overdueRecent.title, overdueOld.title]);
  await expect(upcoming.locator('.assignment-surface')).toHaveCount(1);
  await expect(overdue.locator('.assignment-surface')).toHaveCount(0);
  await expect(upcoming.getByRole('link', { name: /전체 보기/ })).toHaveAttribute('href', '/assignments?status=missing');
  await expect(overdue.getByRole('link', { name: /전체 보기/ })).toHaveAttribute('href', '/assignments?status=missing');
  for (const title of [completedFuture.title, completedPast.title]) {
    await expect(upcoming).not.toContainText(title); await expect(overdue).not.toContainText(title);
  }
  const positions = await Promise.all([upcoming.boundingBox(), overdue.boundingBox()]);
  expect(positions[0]!.y + positions[0]!.height).toBeLessThan(positions[1]!.y);
});

test('overdue-only data shows a compact empty upcoming group and preserves the closed submission policy', async ({ page }) => {
  const assignments = [];
  for (let index = 0; index < 4; index++) {
    const assignment = await scenario.createAssignment({ title: `기한 지난 실습 ${index + 1}` });
    await deadline(assignment, Date.now() - (index + 1) * 3600000); assignments.push(assignment);
  }
  await page.goto('/dashboard');
  const upcoming = page.getByRole('region', { name: '다음 과제', exact: true });
  const overdue = page.getByRole('region', { name: '기한 지난 과제', exact: true });
  await expect(upcoming).toContainText('예정된 미제출 과제가 없습니다.');
  await expect(upcoming.getByRole('heading', { level: 2 })).toHaveText('다음 과제0');
  await expect(upcoming.locator('.assignment-surface')).toHaveCount(0);
  await expect(overdue.getByRole('heading', { level: 2 })).toHaveText('기한 지난 과제4');
  await expect(overdue.getByRole('heading', { level: 3 })).toHaveText(assignments.slice(0, 3).map(item => item.title));
  await overdue.getByRole('link', { name: new RegExp(assignments[0].title) }).click();
  await expect(page).toHaveURL(`/assignments/${assignments[0].id}`);
  await expect(page.getByRole('button', { name: '제출 기간이 종료되었습니다', exact: true })).toBeDisabled();
  await page.goto(`/assignments/${assignments[0].id}/submit`);
  await expect(page.getByRole('textbox', { name: '메모 및 질문 (선택)' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '제출 마감', exact: true })).toBeDisabled();
});

test('fully submitted assignments show the completed empty state without overdue rows', async ({ page }) => {
  for (let index = 0; index < 3; index++) {
    const assignment = await scenario.createAssignment();
    await submit(assignment.id); await deadline(assignment, Date.now() - 3600000);
  }
  await page.goto('/dashboard');
  await expect(page.getByRole('region', { name: '다음 과제', exact: true })).toContainText('모든 과제를 제출했습니다');
  await expect(page.getByRole('region', { name: '기한 지난 과제', exact: true })).toHaveCount(0);
  await expect(page.locator('.assignment-surface')).toHaveCount(0);
});

test('an empty assignment collection shows its own empty state without implying completion', async ({ page }) => {
  await page.goto('/dashboard');
  const upcoming = page.getByRole('region', { name: '다음 과제', exact: true });
  await expect(upcoming).toContainText('아직 등록된 과제가 없습니다');
  await expect(upcoming).not.toContainText('모든 과제를 제출했습니다');
  await expect(page.getByRole('region', { name: '기한 지난 과제', exact: true })).toHaveCount(0);
});
