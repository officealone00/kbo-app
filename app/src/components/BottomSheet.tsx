import { useEffect, useRef, type ReactNode } from 'react';
import { pushSheet } from '@/lib/sheetStack';

/** 화면 아래에서 올라오는 시트. 토스 뒤로가기·배경·✕로 닫혀요 (2026-10-18) */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    return pushSheet(() => closeRef.current());
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="닫기" className="absolute inset-0 bg-black/40 fade-in" onClick={onClose} />
      <div
        className="relative w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-t-3xl bg-white px-5 pt-5 sheet-up"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          {title ? <h3 className="text-[19px] font-bold text-toss-gray-900 leading-snug">{title}</h3> : <span />}
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="-mr-1 h-8 w-8 shrink-0 rounded-full bg-toss-gray-100 text-toss-gray-600"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** 광고 전에 꼭 물어보는 시트 — [다음에]는 그냥 닫히고, [광고 보기]를 눌러야만 광고가 나와요 */
export function ConfirmSheet({
  open,
  title = '짧은 광고를 볼까요?',
  desc,
  confirm = '광고 보기',
  cancel = '다음에',
  onConfirm,
  onClose,
}: {
  open: boolean;
  title?: string;
  desc?: string;
  confirm?: string;
  cancel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {desc && <p className="text-[15px] leading-relaxed text-toss-gray-600 whitespace-pre-line">{desc}</p>}
      <div className="mt-6 flex gap-2">
        <button type="button" onClick={onClose} className="flex-1 rounded-2xl bg-toss-gray-100 py-4 text-[16px] font-semibold text-toss-gray-800">
          {cancel}
        </button>
        <button type="button" onClick={onConfirm} className="flex-1 rounded-2xl bg-toss-blue py-4 text-[16px] font-bold text-white">
          {confirm}
        </button>
      </div>
    </BottomSheet>
  );
}
