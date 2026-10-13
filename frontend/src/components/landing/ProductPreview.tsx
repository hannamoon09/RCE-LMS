import { Bell, ChevronRight, ClipboardList, Gauge, MessageSquare, CalendarDays, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { BrandMark } from '@/components/dashboard/BrandMark';
import { Card } from '@/components/ui/card';

export function ProductPreview() {
  return <div data-product-preview className="product-preview" aria-label="RCE LMS 기능 안내">
    <div className="preview-window-bar"><span className="preview-window-dots" aria-hidden="true"><i /><i /><i /></span><span>RCE LMS <ChevronRight size={11} /> Workspace</span><span className="preview-guide-label">기능 안내</span></div>
    <div className="preview-app">
      <aside className="preview-sidebar" aria-hidden="true"><BrandMark /><div className="preview-menu selected"><Gauge size={15} />대시보드</div><div className="preview-menu"><ClipboardList size={15} />과제</div><div className="preview-menu"><Bell size={15} />공지사항</div><div className="preview-menu"><CheckCircle2 size={15} />내 제출물</div><div className="preview-sidebar-note">내 학습공간<br /><span>배정된 분야의 학습 정보</span></div></aside>
      <div className="preview-main"><div className="preview-greeting"><div><p>YOUR WORKSPACE</p><h3>오늘의 학습을 이어가세요.</h3></div><span className="preview-own-track">나의 분야</span></div>
        <div className="preview-columns"><div className="preview-assignment-column"><div className="preview-stats"><Card className="p-4"><p>과제 확인</p><ClipboardList className="mt-3" size={24} aria-hidden="true" /></Card><Card className="p-4"><p>실습 제출</p><CheckCircle2 className="mt-3" size={24} aria-hidden="true" /></Card><Card className="p-4"><p>피드백 확인</p><MessageSquare className="mt-3" size={24} aria-hidden="true" /></Card></div>
          <Card className="preview-assignments"><div className="preview-section-title">과제부터 제출까지</div><div className="preview-assignment"><div className="preview-assignment-meta"><span>ASSIGNMENTS</span><ArrowUpRight size={13} /></div><div className="preview-assignment-title"><span>과제와 마감 확인</span></div><div className="preview-assignment-footer"><span><CalendarDays size={11} />안내와 첨부 자료를 함께 확인하세요.</span></div></div><div className="preview-assignment"><div className="preview-assignment-meta"><span>SUBMISSIONS</span><ArrowUpRight size={13} /></div><div className="preview-assignment-title"><span>실습 결과 제출</span></div><div className="preview-assignment-footer"><span>파일과 메모로 학습 과정을 남기세요.</span></div></div></Card>
        </div><div className="preview-secondary"><Card className="p-5"><p className="preview-section-title">운영진 피드백</p><h4>제출 이후의 배움</h4><p className="preview-feedback-copy">검토가 끝나면 내 제출물에서 점수와 피드백을 확인할 수 있습니다.</p></Card><Card className="p-5"><p className="preview-section-title">공지사항</p><p className="preview-notice"><Bell size={12} />동아리 공통 안내와 내 분야의 공지를 확인하세요.</p></Card></div></div>
      </div>
    </div>
  </div>;
}
