import { test, expect, type APIRequestContext } from '@playwright/test';
import { csrf, loginAs } from './api-helpers';
import { createScenario, type Scenario } from './scenario';

const fields = [['WEB', '웹해킹'], ['PWN', '포너블'], ['REVERSING', '리버싱'], ['FORENSICS', '포렌식']] as const;
for (const [track, label] of fields) {
  test(`${label} rankings keep own FIELD and privacy even with a forged query`, async ({ page, context, playwright }, testInfo) => {
    const own = await createScenario(playwright, testInfo.project.use.baseURL, track);
    const foreign = await createScenario(playwright, testInfo.project.use.baseURL, track === 'WEB' ? 'PWN' : 'WEB');
    try {
      await loginAs(context.request, own.member.studentId, own.member.password);
      const rows = await (await context.request.get('/api/rankings/me')).json();
      const current = rows.find((entry: { isMe: boolean }) => entry.isMe);
      await page.goto('/rankings?track=forged');
      const table = page.getByRole('table', { name: '분야 순위', exact: true });
      await expect(table.locator('tbody tr')).toHaveCount(rows.length);
      await expect(page.locator('main')).toContainText(`FIELD ${label}`);
      await expect(page.getByRole('group', { name: '순위 분야' })).toHaveCount(0);
      const mine = table.locator('[data-current-user="true"]');
      await expect(mine).toHaveAttribute('data-rank', String(current.rank));
      await expect(mine).toContainText(own.member.name);
      await expect(mine).toContainText('미채점');
      await expect(mine.getByRole('cell').nth(2)).toHaveText('0');
      await expect(mine.getByRole('cell').nth(3)).toHaveText('0.0');
      for (const privateValue of [own.member.id, own.member.studentId, foreign.member.name, foreign.staff.name]) await expect(page.locator('main')).not.toContainText(privateValue);
      await page.reload();
      await expect(mine).toHaveAttribute('data-rank', String(current.rank));
      await loginAs(context.request, own.staff.studentId, own.staff.password);
      await page.goto('/rankings?track=WEB');
      await expect(page.locator('main')).toContainText(`FIELD ${label}`);
      await expect(page.locator('[data-current-user="true"]')).toHaveCount(0);
      await expect(page.getByRole('combobox')).toHaveCount(0);
      await expect(table.getByRole('columnheader')).toHaveText(['순위', '학생', '총점', '평균', '채점 완료']);
    } finally { await foreign.dispose(); await own.dispose(); }
  });
}

async function scored(scenario: Scenario, request: APIRequestContext, assignmentId: string, score: number) {
  const response = await request.post(`/api/assignments/${assignmentId}/submission`, { headers: await csrf(request), data: { content: '순위 화면 검증' } });
  expect(response.status()).toBe(200);
  const submission = await response.json();
  expect((await scenario.staffRequest.patch(`/api/admin/submissions/${submission.id}/review`, { headers: await csrf(scenario.staffRequest), data: { score } })).status()).toBe(200);
}

test('long rankings preserve a lower own rank, every student, and mobile reduced-motion final states', async ({ page, context, playwright }, testInfo) => {
  const scenario = await createScenario(playwright, testInfo.project.use.baseURL);
  const peer = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
  try {
    const assignment = await scenario.createAssignment();
    await scored(scenario, scenario.memberRequest, assignment.id, 1);
    for (let index = 0; index < 14; index++) {
      const student = await scenario.createMember(`순위 학생 ${index + 1}`);
      await loginAs(peer, student.studentId, student.password);
      await scored(scenario, peer, assignment.id, 100 - index);
    }
    await loginAs(context.request, scenario.member.studentId, scenario.member.password);
    const rows = await (await context.request.get('/api/rankings/me')).json();
    await page.goto('/rankings');
    const table = page.getByRole('table', { name: '분야 순위', exact: true });
    await expect(table.locator('tbody tr')).toHaveCount(rows.length);
    const mine = table.locator('[data-current-user="true"]');
    await expect(mine).toHaveAttribute('data-rank', '15');
    await expect(mine.getByRole('cell').nth(2)).toHaveText('1');
    await expect(page.locator('[data-ranking-summary]')).toContainText('15');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(table).toBeHidden();
    const own = page.locator('article[data-current-user="true"]');
    await expect(own).toContainText(scenario.member.name);
    await expect(own).toContainText('1.0');
    await expect(page.locator('article[data-ranking-user]')).toHaveCount(rows.length);
    await expect(own).toHaveCSS('opacity', '1');
    await expect(own).toHaveCSS('translate', 'none');
    await expect(page.locator('[data-page-transition]')).toHaveCSS('opacity', '1');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  } finally { await peer.dispose(); await scenario.dispose(); }
});
