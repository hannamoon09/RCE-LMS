import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { csrf, fixtureName, loginAs } from './api-helpers';
import { createScenario } from './scenario';

const assignmentInput = (title: string) => ({
  title, description: '[E2E] Private beta authorization fixture.', difficulty: 'Medium' as const,
  deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
});

function upload(data: object, name: string, content: string, type = 'text/plain') {
  const form = new FormData();
  form.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }), 'data.json');
  form.append('files', new Blob([content], { type }), name);
  return form;
}

async function denied(response: APIResponse, status: number) {
  expect(response.status(), `${response.url()} must reject the request`).toBe(status);
  expect(await response.json()).toMatchObject({ code: expect.any(String), message: expect.any(String) });
}

async function list(request: APIRequestContext, path: string) {
  const response = await request.get(path);
  expect(response.status()).toBe(200);
  return response.json();
}

test('[E2E beta] role and track forgery cannot create or promote STAFF and MEMBER cannot access admin APIs', async ({ playwright, baseURL }) => {
  const scenario = await createScenario(playwright, baseURL, 'WEB');
  try {
    const originalUsers = await list(scenario.staffRequest, '/api/admin/users');
    const studentId = `82${Date.now()}${Math.floor(Math.random() * 10000)}`;
    for (const fields of [{ role: 'STAFF' }, { track: 'PWN' }, { active: false }]) {
      const response = await scenario.staffRequest.post('/api/admin/users', {
        headers: await csrf(scenario.staffRequest),
        data: { name: fixtureName('[E2E] Forbidden account'), studentId, initialPassword: `Beta-${randomUUID()}!`, ...fields },
      });
      // If this ever regresses, still register the unexpected account for exact fixture cleanup.
      if (response.ok()) scenario.registerUser((await response.json()).id);
      await denied(response, 400);
    }
    for (const fields of [{ role: 'STAFF' }, { track: 'PWN' }]) {
      await denied(await scenario.staffRequest.patch(`/api/admin/users/${scenario.member.id}`, {
        headers: await csrf(scenario.staffRequest), data: { name: scenario.member.name, ...fields },
      }), 400);
    }
    expect(await list(scenario.staffRequest, '/api/admin/users')).toEqual(originalUsers);
    expect(await list(scenario.memberRequest, '/api/auth/me')).toMatchObject({
      id: scenario.member.id, role: 'MEMBER', track: 'WEB', active: true,
    });
    for (const path of ['/api/admin/users', '/api/admin/assignments', '/api/admin/submissions', '/api/admin/rankings']) {
      await denied(await scenario.memberRequest.get(path), 403);
    }
    await denied(await scenario.memberRequest.patch(`/api/admin/users/${scenario.member.id}`, {
      headers: await csrf(scenario.memberRequest), data: { name: 'Unauthorized edit' },
    }), 403);
  } finally { await scenario.dispose(); }
});

test('[E2E beta] real PWN assignment, submission, student and file IDs remain inaccessible to WEB MEMBER and STAFF', async ({ playwright, baseURL }) => {
  const pwn = await createScenario(playwright, baseURL, 'PWN');
  const web = await createScenario(playwright, baseURL, 'WEB');
  const peer = await playwright.request.newContext({ baseURL });
  try {
    const input = assignmentInput(fixtureName('[E2E] PWN private assignment'));
    const created = await pwn.staffRequest.post('/api/admin/assignments', {
      headers: await csrf(pwn.staffRequest),
      multipart: upload({ ...input, retainedFileIds: [] }, 'pwn-instructions.txt', 'PWN assignment private bytes'),
    });
    expect(created.status()).toBe(201);
    const assignment = await created.json();
    const submitted = await pwn.memberRequest.post(`/api/assignments/${assignment.id}/submission`, {
      headers: await csrf(pwn.memberRequest),
      multipart: upload({ content: 'PWN private submission', retainedFileIds: [] }, 'pwn-solution.txt', 'PWN submission private bytes'),
    });
    expect(submitted.status()).toBe(200);
    const submission = await submitted.json();
    const assignmentFile = assignment.attachments[0];
    const submissionFile = submission.files[0];
    for (const actor of [pwn.memberRequest, pwn.staffRequest]) {
      const material = await actor.get(`/api/files/${assignmentFile.id}`);
      expect(material.status()).toBe(200);
      expect(await material.text()).toBe('PWN assignment private bytes');
      const solution = await actor.get(`/api/files/${submissionFile.id}`);
      expect(solution.status()).toBe(200);
      expect(await solution.text()).toBe('PWN submission private bytes');
    }
    const peerAccount = await pwn.createMember('[E2E] PWN peer');
    await loginAs(peer, peerAccount.studentId, peerAccount.password);
    expect((await peer.get(`/api/files/${assignmentFile.id}`)).status()).toBe(200);
    await denied(await peer.get(`/api/files/${submissionFile.id}`), 404);

    for (const actor of [web.memberRequest, web.staffRequest]) {
      await denied(await actor.get(`/api/assignments/${assignment.id}`), 404);
      await denied(await actor.get(`/api/files/${assignmentFile.id}`), 404);
      await denied(await actor.get(`/api/files/${submissionFile.id}`), 404);
      expect(await list(actor, '/api/assignments?track=PWN')).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: assignment.id })]));
    }
    await denied(await web.memberRequest.get(`/api/assignments/${assignment.id}/submission`), 404);
    await denied(await web.memberRequest.post(`/api/assignments/${assignment.id}/submission`, {
      headers: await csrf(web.memberRequest), data: { content: 'Unauthorized cross-track submission' },
    }), 404);
    await denied(await web.memberRequest.patch(`/api/admin/submissions/${submission.id}/review`, {
      headers: await csrf(web.memberRequest), data: { score: 100, feedback: 'Unauthorized review' },
    }), 403);
    await denied(await web.staffRequest.get(`/api/admin/submissions?assignmentId=${assignment.id}`), 404);
    await denied(await web.staffRequest.patch(`/api/admin/submissions/${submission.id}/review`, {
      headers: await csrf(web.staffRequest), data: { score: 100, feedback: 'Cross-track review' },
    }), 404);
    await denied(await web.staffRequest.patch(`/api/admin/assignments/${assignment.id}`, {
      headers: await csrf(web.staffRequest), data: { ...input, title: 'Cross-track edit' },
    }), 404);
    await denied(await web.staffRequest.delete(`/api/admin/assignments/${assignment.id}`, { headers: await csrf(web.staffRequest) }), 404);
    await denied(await web.staffRequest.patch(`/api/admin/users/${pwn.member.id}`, {
      headers: await csrf(web.staffRequest), data: { active: false },
    }), 404);
    expect(await list(web.staffRequest, '/api/admin/users?track=PWN')).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: pwn.member.id })]));
    expect(await list(web.staffRequest, '/api/admin/submissions?track=PWN')).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: submission.id })]));
    for (const [actor, path] of [[web.staffRequest, '/api/admin/rankings?track=PWN'], [web.memberRequest, '/api/rankings/me?track=PWN']] as const) {
      expect(await list(actor, path)).not.toEqual(expect.arrayContaining([expect.objectContaining({ name: pwn.member.name })]));
    }
    expect(await list(pwn.memberRequest, '/api/auth/me')).toMatchObject({ active: true });
    expect(await list(pwn.memberRequest, `/api/assignments/${assignment.id}`)).toMatchObject({ title: input.title });
    expect(await list(pwn.memberRequest, `/api/assignments/${assignment.id}/submission`)).toMatchObject({ id: submission.id, status: 'PENDING', score: null });
  } finally { await peer.dispose(); await web.dispose(); await pwn.dispose(); }
});

test('[E2E beta] backend rejects blank titles, out-of-range scores and forbidden files without corrupting saved data', async ({ playwright, baseURL }) => {
  const scenario = await createScenario(playwright, baseURL, 'WEB');
  try {
    const input = assignmentInput(fixtureName('[E2E] Validation assignment'));
    const assignmentsBefore = await list(scenario.staffRequest, '/api/admin/assignments');
    await denied(await scenario.staffRequest.post('/api/admin/assignments', {
      headers: await csrf(scenario.staffRequest), data: { ...input, title: '   ' },
    }), 400);
    expect(await list(scenario.staffRequest, '/api/admin/assignments')).toEqual(assignmentsBefore);
    const assignment = await scenario.createAssignment(input);
    await denied(await scenario.staffRequest.patch(`/api/admin/assignments/${assignment.id}`, {
      headers: await csrf(scenario.staffRequest), data: { ...input, title: '' },
    }), 400);
    const submitted = await scenario.memberRequest.post(`/api/assignments/${assignment.id}/submission`, {
      headers: await csrf(scenario.memberRequest),
      multipart: upload({ content: 'Original valid submission', retainedFileIds: [] }, 'valid.txt', 'Original valid bytes'),
    });
    expect(submitted.status()).toBe(200);
    const submission = await submitted.json();
    const reviewed = await scenario.staffRequest.patch(`/api/admin/submissions/${submission.id}/review`, {
      headers: await csrf(scenario.staffRequest), data: { score: 92, feedback: '[E2E] Preserve this valid review' },
    });
    expect(reviewed.status()).toBe(200);
    const original = await list(scenario.memberRequest, `/api/assignments/${assignment.id}/submission`);
    expect(original).toMatchObject({ status: 'REVIEWED', score: 92, feedback: '[E2E] Preserve this valid review' });
    for (const score of [-1, 101]) {
      await denied(await scenario.staffRequest.patch(`/api/admin/submissions/${submission.id}/review`, {
        headers: await csrf(scenario.staffRequest), data: { score, feedback: 'Invalid score must not save' },
      }), 400);
    }
    for (const file of [{ name: 'forbidden.html', type: 'text/html' }, { name: 'forged.png', type: 'image/png' }]) {
      const response = await scenario.memberRequest.post(`/api/assignments/${assignment.id}/submission`, {
        headers: await csrf(scenario.memberRequest),
        multipart: upload({ content: 'Invalid replacement must not save', retainedFileIds: [] }, file.name, 'Harmless invalid file fixture', file.type),
      });
      await denied(response, 400);
      expect(await response.json()).toMatchObject({ code: 'INVALID_FILE' });
    }
    expect(await list(scenario.memberRequest, `/api/assignments/${assignment.id}/submission`)).toEqual(original);
    expect(await list(scenario.memberRequest, `/api/assignments/${assignment.id}`)).toMatchObject({ title: input.title });
    const preservedFile = await scenario.memberRequest.get(`/api/files/${submission.files[0].id}`);
    expect(preservedFile.status()).toBe(200);
    expect(await preservedFile.text()).toBe('Original valid bytes');
    expect(await list(scenario.memberRequest, '/api/rankings/me')).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: scenario.member.name, totalScore: 92, reviewedCount: 1 }),
    ]));
  } finally { await scenario.dispose(); }
});

test('[E2E beta] inactive users cannot log in and revoked or logged-out sessions cannot be replayed after reactivation', async ({ playwright, baseURL }) => {
  const scenario = await createScenario(playwright, baseURL, 'WEB');
  const originalState = await scenario.memberRequest.storageState();
  const replay = await playwright.request.newContext({ baseURL, storageState: originalState });
  const fresh = await playwright.request.newContext({ baseURL });
  try {
    expect(originalState.cookies.find(cookie => cookie.name === 'JSESSIONID')?.httpOnly).toBe(true);
    const deactivated = await scenario.staffRequest.patch(`/api/admin/users/${scenario.member.id}`, {
      headers: await csrf(scenario.staffRequest), data: { active: false },
    });
    expect(deactivated.status()).toBe(200);
    await denied(await scenario.memberRequest.get('/api/assignments'), 401);
    await denied(await scenario.memberRequest.get('/api/auth/me'), 401);
    const login = await fresh.post('/api/auth/login', {
      headers: await csrf(fresh), data: { studentId: scenario.member.studentId, password: scenario.member.password },
    });
    await denied(login, 401);
    expect((await fresh.storageState()).cookies.some(cookie => cookie.name === 'JSESSIONID')).toBe(false);
    await denied(await fresh.get('/api/auth/me'), 401);
    const reactivated = await scenario.staffRequest.patch(`/api/admin/users/${scenario.member.id}`, {
      headers: await csrf(scenario.staffRequest), data: { active: true },
    });
    expect(reactivated.status()).toBe(200);
    await denied(await replay.get('/api/auth/me'), 401);
    expect(await loginAs(fresh, scenario.member.studentId, scenario.member.password)).toMatchObject({ active: true });
    const beforeLogout = await fresh.storageState();
    const logout = await fresh.post('/api/auth/logout', { headers: await csrf(fresh) });
    expect([200, 204]).toContain(logout.status());
    await denied(await fresh.get('/api/assignments'), 401);
    const loggedOutReplay = await playwright.request.newContext({ baseURL, storageState: beforeLogout });
    try { await denied(await loggedOutReplay.get('/api/auth/me'), 401); }
    finally { await loggedOutReplay.dispose(); }
  } finally { await replay.dispose(); await fresh.dispose(); await scenario.dispose(); }
});
