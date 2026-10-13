import { useEffect, useState, type FormEvent, type RefObject } from 'react';
import { type LMSAssignment } from '@/data/lmsData';
import { type SelectedFile } from '@/data/lmsData';
import type { AssignmentInput } from '@/api/assignments';
import { Button } from '@/components/ui/button';
import { FilePicker } from '@/components/shared/FilePicker';
import { FormMessage } from '@/components/shared/Primitives';

const localDateTime = (date: string) => {
  const value = new Date(date);
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

type AssignmentEditorProps = {
  assignment?: LMSAssignment;
  onSave: (assignment: AssignmentInput, files: SelectedFile[], signal: AbortSignal) => Promise<boolean>;
  onCancel: () => void;
  saveRequest: RefObject<AbortController | null>;
};

export function AssignmentEditor({ assignment, onSave, onCancel, saveRequest }: AssignmentEditorProps) {
  const [title, setTitle] = useState(assignment?.title || '');
  const [deadline, setDeadline] = useState(localDateTime(assignment?.deadline || new Date(Date.now() + 7 * 86400000).toISOString()));
  const [description, setDescription] = useState(assignment?.description || '');
  const [difficulty, setDifficulty] = useState<LMSAssignment['difficulty']>(assignment?.difficulty || 'Medium');
  const [files, setFiles] = useState<SelectedFile[]>(assignment?.attachments || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => () => { saveRequest.current?.abort(); }, [saveRequest]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saveRequest.current) return;
    if (!title.trim() || !description.trim()) { setError('과제명과 설명을 입력해 주세요.'); return; }
    const timestamp = new Date(deadline).getTime();
    if (!Number.isFinite(timestamp)) { setError('마감 일시를 확인해 주세요.'); return; }
    if (!assignment && timestamp <= Date.now()) { setError('새 과제의 마감은 현재 시간 이후로 설정해 주세요.'); return; }
    const startedPath = window.location.pathname;
    const controller = new AbortController();
    saveRequest.current = controller;
    setSaving(true);
    setError('');
    try {
      if (window.location.pathname !== startedPath) controller.abort();
      if (controller.signal.aborted) throw new DOMException('저장이 취소되었습니다.', 'AbortError');
      const saved = await onSave({
        title: title.trim(), description: description.trim(),
        deadline: new Date(timestamp).toISOString(), difficulty,
      }, files, controller.signal);
      if (!saved && !controller.signal.aborted) throw new Error('과제를 저장하지 못했습니다. 내용을 확인한 뒤 다시 시도해 주세요.');
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '과제를 저장하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      if (saveRequest.current === controller) saveRequest.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  };

  return <form onSubmit={save} className="space-y-5" aria-busy={saving}>
    <div><label htmlFor="assignment-title" className="field-label">과제명</label><input autoFocus id="assignment-title" className="field" required maxLength={120} disabled={saving} value={title} onChange={event => setTitle(event.target.value)} /></div>
    <div><label htmlFor="assignment-description" className="field-label">과제 설명</label><textarea id="assignment-description" className="field" rows={6} maxLength={20000} required disabled={saving} value={description} onChange={event => setDescription(event.target.value)} /></div>
    <div><label htmlFor="assignment-deadline" className="field-label">마감 일시</label><input id="assignment-deadline" type="datetime-local" className="field" required disabled={saving} value={deadline} onChange={event => setDeadline(event.target.value)} /></div>
    <div><label htmlFor="assignment-difficulty" className="field-label">난이도</label><select id="assignment-difficulty" className="field" disabled={saving} value={difficulty} onChange={event => setDifficulty(event.target.value as LMSAssignment['difficulty'])}>{['Low', 'Medium', 'High'].map(value => <option key={value}>{value}</option>)}</select></div>
    <section className="border-t border-border pt-5"><h3 className="mb-2 text-sm font-medium">첨부파일 <span className="font-normal text-muted-foreground">(선택)</span></h3><p className="mb-4 text-xs leading-6 text-muted-foreground">학생에게 제공할 자료가 있을 때만 파일을 추가하세요.</p><FilePicker files={files} onChange={setFiles} disabled={saving} label="과제 첨부파일 선택" /></section>
    {error && <FormMessage error>{error}</FormMessage>}
    <div className="flex justify-end gap-3 border-t border-border pt-5"><Button type="button" variant="outline" onClick={onCancel}>취소</Button><Button type="submit" disabled={saving}>{saving ? '저장 중' : assignment ? '변경 사항 저장' : '과제 생성'}</Button></div>
  </form>;
}
