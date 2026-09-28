import { Bell, ChevronRight, ClipboardList, Gauge, MessageSquare, CalendarDays, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { BrandMark } from '@/components/dashboard/BrandMark';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/Primitives';
import { previewAssignments, previewFeedback, previewNotices, previewStats } from '@/data/landingData';

export function ProductPreview() {
  return <div data-product-preview className="product-preview" aria-label="RCE LMS 대시보드 미리보기">
    <div className="preview-window-bar"><span className="preview-window-dots" aria-hidden="true"><i /><i /><i /></span><span>RCE LMS <ChevronRight size={11} /> Dashboard</span><span className="preview-sample-label">미리보기</span></div>
    <div className="preview-app">
      <aside className="preview-sidebar" aria-hidden="true"><BrandMark /><div className="preview-menu selected"><Gauge size={15} />대시보드</div><div className="preview-menu"><ClipboardList size={15} />과제</div><div className="preview-menu"><Bell size={15} />공지사항</div><div className="preview-menu"><CheckCircle2 size={15} />내 제출물</div><div className="preview-sidebar-note">내 학습공간<br /><span>웹해킹</span></div></aside>
      <div className="preview-main"><div className="preview-greeting"><div><p>YOUR WORKSPACE</p><h3>오늘의 학습을 이어가세요.</h3></div><span className="preview-own-track">웹해킹</span></div>
        <div className="preview-columns"><div className="preview-assignment-column"><div className="preview-stats">{previewStats.map(stat => <Card key={stat.label} className="p-4"><p>{stat.label}</p><strong>{stat.value}</strong></Card>)}</div>
          <Card className="preview-assignments"><div className="preview-section-title">최근 과제<span>02</span></div>{previewAssignments.map(assignment => <div key={assignment.id} className="preview-assignment"><div className="preview-assignment-meta"><span>과제 안내</span><ArrowUpRight size={13} /></div><div className="preview-assignment-title"><span>{assignment.title}</span><StatusBadge status={assignment.status} appearance="badge" /></div><div className="preview-assignment-footer"><span><CalendarDays size={11} />{assignment.deadline === '마감' ? '제출 기간 종료' : `마감 ${assignment.deadline}`}</span>{assignment.feedback && <span className="preview-feedback-ready"><MessageSquare size={11} />피드백 도착</span>}</div></div>)}</Card>
        </div><div className="preview-secondary"><Card className="p-5"><p className="preview-section-title">최근 피드백</p><h4>{previewFeedback.title}</h4><p className="preview-feedback-copy">{previewFeedback.body}</p><p className="preview-feedback-author">{previewFeedback.author} · {previewFeedback.status}</p></Card><Card className="p-5"><p className="preview-section-title">최근 공지</p>{previewNotices.map(notice => <p key={notice} className="preview-notice"><Bell size={12} />{notice}</p>)}</Card></div></div>
      </div>
    </div>
  </div>;
}
