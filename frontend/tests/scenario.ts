import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type PlaywrightWorkerArgs } from '@playwright/test';
import { csrf, fixtureName, loginAs, seedPassword, staffStudentId } from './api-helpers';

type Track = 'WEB' | 'PWN' | 'REVERSING' | 'FORENSICS';
type Account = { id: string; name: string; studentId: string; password: string; track: Track; role: 'MEMBER' | 'STAFF'; active: boolean };
type AssignmentInput = { title: string; description: string; difficulty: 'Low' | 'Medium' | 'High'; deadline: string };
type Assignment = AssignmentInput & { id: string; author: string; attachments: { id: string; name: string; size: number; type: string }[] };
type NoticeInput = { title: string; body: string; category: string; important: boolean };
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

/** Trusted test provisioning only. The database name is intentionally a fixed disposable database. */
function sql(statement: string): string {
  const user = process.env.DB_USERNAME;
  if (!user) throw new Error('Run browser tests through scripts/e2e-test.sh to load local test credentials.');
  return execFileSync('docker', ['compose', 'exec', '-T', 'postgres', 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', user, '-d', 'rce_lms_e2e'], { cwd: repositoryRoot, input: statement, encoding: 'utf8' }).trim();
}

export async function createScenario(playwright: PlaywrightWorkerArgs['playwright'], baseURL: string | undefined, track: Track = 'PWN') {
  if (!baseURL || new URL(baseURL).port !== '5181') throw new Error('Scenarios only run against the isolated browser-test server on 5181.');
  const staffId = randomUUID();
  const staffNumber = `80${Date.now()}${Math.floor(Math.random() * 10000)}`;
  const name = fixtureName('화면 운영진');
  // STAFF cannot be created through the public API; copy only the disposable seed account's hash.
  sql(`INSERT INTO users(id,student_id,password_hash,name,role,track,active,joined_at)
       SELECT ${quote(staffId)},${quote(staffNumber)},password_hash,${quote(name)},'STAFF',${quote(track)},true,now()
       FROM users WHERE student_id=${quote(staffStudentId)};`);
  const staffRequest = await playwright.request.newContext({ baseURL });
  const memberRequest = await playwright.request.newContext({ baseURL });
  const staff = { ...await loginAs(staffRequest, staffNumber), password: seedPassword() } as Account;
  const ids = new Set<string>([staffId]);
  const registerUser = (id: string) => { ids.add(id); };
  const createMember = async (label = '화면 학생'): Promise<Account> => {
    const input = { name: fixtureName(label), studentId: `81${Date.now()}${Math.floor(Math.random() * 10000)}`, initialPassword: `Scenario-${randomUUID()}!` };
    const response = await staffRequest.post('/api/admin/users', { headers: await csrf(staffRequest), data: input });
    expect(response.status()).toBe(201);
    const saved = await response.json(); ids.add(saved.id);
    return { ...saved, password: input.initialPassword };
  };
  const member = await createMember();
  await loginAs(memberRequest, member.studentId, member.password);
  const createAssignment = async (overrides: Partial<AssignmentInput> = {}): Promise<Assignment> => {
    const response = await staffRequest.post('/api/admin/assignments', { headers: await csrf(staffRequest), data: {
      title: fixtureName('화면 실습'), description: '실제 API로 저장한 회귀 검증용 과제입니다.', difficulty: 'Medium', deadline: new Date(Date.now() + 7 * 86400000).toISOString(), ...overrides,
    } });
    expect(response.status()).toBe(201); return response.json();
  };
  const createNotice = async (overrides: Partial<NoticeInput> = {}, global = false) => {
    const response = await staffRequest.post('/api/admin/notices', { headers: await csrf(staffRequest), data: {
      title: fixtureName('화면 공지'), body: '실제 API로 저장한 공지 내용입니다.', category: '운영 안내', important: false, ...overrides,
    } });
    expect(response.status()).toBe(201);
    const saved = await response.json();
    if (global) { sql(`UPDATE notices SET track=NULL WHERE id=${quote(saved.id)};`); saved.track = null; }
    return saved;
  };
  const dispose = async () => {
    await staffRequest.dispose(); await memberRequest.dispose();
    const users = [...ids].map(quote).join(',');
    const assignments = `SELECT id FROM assignments WHERE author_id=${quote(staffId)}`;
    const submissions = `SELECT id FROM submissions WHERE assignment_id IN (${assignments}) OR user_id IN (${users})`;
    const keys = sql(`SELECT storage_key FROM assignment_files WHERE assignment_id IN (${assignments})
      UNION ALL SELECT storage_key FROM submission_files WHERE submission_id IN (${submissions})
      UNION ALL SELECT storage_key FROM profile_files WHERE owner_id IN (${users});`).split('\n').filter(Boolean);
    sql(`BEGIN;
      DELETE FROM submission_files WHERE submission_id IN (${submissions});
      DELETE FROM submissions WHERE assignment_id IN (${assignments}) OR user_id IN (${users});
      DELETE FROM assignment_files WHERE assignment_id IN (${assignments});
      DELETE FROM assignments WHERE author_id=${quote(staffId)};
      DELETE FROM notices WHERE author_id=${quote(staffId)};
      UPDATE users SET profile_image=NULL WHERE id IN (${users});
      DELETE FROM profile_files WHERE owner_id IN (${users});
      DELETE FROM user_preferences WHERE user_id IN (${users});
      DELETE FROM users WHERE id IN (${users});
      COMMIT;`);
    for (const key of keys) if (/^[\da-f-]{36}$/.test(key)) await rm(path.join(repositoryRoot, 'backend-data/e2e-uploads', key), { force: true });
  };
  return { staff, member, staffRequest, memberRequest, createMember, createAssignment, createNotice, registerUser, dispose };
}
export type Scenario = Awaited<ReturnType<typeof createScenario>>;
