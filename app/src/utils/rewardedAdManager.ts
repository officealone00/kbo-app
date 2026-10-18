/**
 * 리워드(보상형) 광고 미리 로딩 관리자 (2026-10-18 정책 대응)
 *
 * 앱인토스 출시 체크리스트: "광고는 사전에 로딩해 두고, 재생 시점에 실시간으로 로딩하지 않아요"
 * - 광고가 필요한 화면에 들어오면 preloadRewardedAd() 로 미리 불러 둔다.
 * - 사용자가 버튼을 누르면 showRewardedAd() 로 바로 재생한다.
 * - 광고가 닫히면 다음 재생을 위해 자동으로 다시 미리 불러 둔다.
 */

type LoadState = 'idle' | 'loading' | 'loaded' | 'unsupported';

let loadState: LoadState = 'idle';
let currentAdGroupId = '';
const readyWaiters: Array<(ok: boolean) => void> = [];

function notifyReady(ok: boolean) {
  while (readyWaiters.length) readyWaiters.shift()?.(ok);
}

async function getSdk(): Promise<any | null> {
  try {
    const mod: any = await import('@apps-in-toss/web-framework');
    if (typeof mod?.loadFullScreenAd !== 'function' || typeof mod?.showFullScreenAd !== 'function') {
      return null;
    }
    if (typeof mod.loadFullScreenAd.isSupported === 'function' && !mod.loadFullScreenAd.isSupported()) {
      return null;
    }
    return mod;
  } catch {
    return null;
  }
}

/** 광고가 필요한 화면에 들어올 때 호출 (여러 번 불러도 안전) */
export async function preloadRewardedAd(adGroupId: string): Promise<void> {
  currentAdGroupId = adGroupId;
  if (loadState === 'loading' || loadState === 'loaded') return;

  const sdk = await getSdk();
  if (!sdk) {
    loadState = 'unsupported';
    notifyReady(false);
    return;
  }

  loadState = 'loading';
  try {
    sdk.loadFullScreenAd({
      options: { adGroupId },
      onEvent: (event: any) => {
        if (event?.type === 'loaded') {
          loadState = 'loaded';
          notifyReady(true);
        }
      },
      onError: (err: unknown) => {
        console.warn('[RewardedAd] 미리 로딩 실패', err);
        loadState = 'idle';
        notifyReady(false);
      },
    });
  } catch (e) {
    console.warn('[RewardedAd] 미리 로딩 오류', e);
    loadState = 'idle';
    notifyReady(false);
  }
}

export function isRewardedAdReady(): boolean {
  return loadState === 'loaded';
}

/** 미리 로딩된 광고를 기다린다 (최대 timeoutMs) */
function waitUntilReady(timeoutMs: number): Promise<boolean> {
  if (loadState === 'loaded') return Promise.resolve(true);
  if (loadState === 'unsupported') return Promise.resolve(false);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    readyWaiters.push((ok) => {
      clearTimeout(timer);
      resolve(ok);
    });
  });
}

export interface ShowRewardedCallbacks {
  onReward: () => void;
  onClose: (result: { rewarded: boolean; failed: boolean }) => void;
  onShow?: () => void;
}

/** 사용자가 버튼을 눌렀을 때 호출 → 미리 로딩된 광고를 재생 */
export async function showRewardedAd(adGroupId: string, cb: ShowRewardedCallbacks): Promise<void> {
  if (loadState === 'idle') void preloadRewardedAd(adGroupId);
  const ready = await waitUntilReady(8000);
  const sdk = ready ? await getSdk() : null;

  if (!ready || !sdk) {
    cb.onClose({ rewarded: false, failed: true });
    return;
  }

  let rewarded = false;
  let closed = false;
  const finish = (failed: boolean) => {
    if (closed) return;
    closed = true;
    loadState = 'idle';
    cb.onClose({ rewarded, failed });
    // 다음 재생을 위해 다시 미리 로딩
    setTimeout(() => void preloadRewardedAd(currentAdGroupId || adGroupId), 500);
  };

  try {
    sdk.showFullScreenAd({
      options: { adGroupId },
      onEvent: (ev: any) => {
        if (ev?.type === 'show' || ev?.type === 'impression') cb.onShow?.();
        if (ev?.type === 'userEarnedReward') {
          rewarded = true;
          cb.onReward();
        }
        if (ev?.type === 'dismissed' || ev?.type === 'closed') finish(false);
        if (ev?.type === 'failedToShow') finish(true);
      },
      onError: (err: unknown) => {
        console.warn('[RewardedAd] 재생 오류', err);
        finish(true);
      },
    });
  } catch (e) {
    console.warn('[RewardedAd] 재생 오류', e);
    finish(true);
  }
}
