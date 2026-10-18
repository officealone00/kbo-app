/**
 * 앱인토스 성장 도구 모음 (2026-10-18)
 * - 공유: Share.createLink + Share.sendMessage (intoss:// 딥링크, 토스 공유 링크로 랜딩)
 * - 리뷰 요청: Review.request — 핵심 행동을 마친 직후, 기기당 1번만
 * - 전환 기록: Analytics.click — 콘솔 '핵심 지표'에서 대표 전환으로 등록할 이벤트
 *
 * 모든 함수는 토스 밖(로컬 브라우저)에서는 조용히 무시되거나 대체 동작을 한다.
 */

async function sdk(): Promise<any | null> {
  try {
    return await import('@apps-in-toss/web-framework');
  } catch {
    return null;
  }
}

/** 공유 시트 열기. path 예: 'intoss://kbo-ranking' */
export async function shareWithTossLink(params: {
  path: string;
  message: string;
  ogImageUrl?: string;
}): Promise<boolean> {
  const s = await sdk();
  try {
    let link = '';
    if (s?.Share?.createLink) {
      link = await s.Share.createLink({ path: params.path, ogImageUrl: params.ogImageUrl });
    } else if (s?.getTossShareLink) {
      link = await s.getTossShareLink(params.path, params.ogImageUrl);
    }
    const text = link ? `${params.message}\n${link}` : params.message;
    if (s?.Share?.sendMessage) {
      await s.Share.sendMessage({ message: text });
      return true;
    }
    if (s?.share) {
      await s.share({ message: text });
      return true;
    }
  } catch (e) {
    console.warn('[share] 공유 실패', e);
  }
  // 토스 밖: 브라우저 공유 / 클립보드
  try {
    if (navigator.share) {
      await navigator.share({ text: params.message });
      return true;
    }
    await navigator.clipboard?.writeText(params.message);
    return true;
  } catch {
    return false;
  }
}

/** 핵심 행동 직후 리뷰 요청 — 기기당 1번만 (같은 세션 반복 호출 금지 정책) */
export async function requestReviewOnce(storageKey: string): Promise<void> {
  try {
    if (localStorage.getItem(storageKey) === '1') return;
  } catch {
    /* noop */
  }
  const s = await sdk();
  try {
    const req = s?.Review?.request ?? s?.requestReview;
    if (!req) return;
    if (typeof req.isSupported === 'function' && !req.isSupported()) return;
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      /* noop */
    }
    await req();
  } catch (e) {
    console.warn('[review] 요청 실패', e);
  }
}

/** 전환/행동 이벤트 기록 (콘솔 핵심 지표용) */
export async function logEvent(logName: string, params: Record<string, string | number | boolean> = {}) {
  const s = await sdk();
  try {
    await s?.Analytics?.click?.({ log_name: logName, ...params });
  } catch {
    /* noop */
  }
}
