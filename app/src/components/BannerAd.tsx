import { useEffect, useRef, useState } from 'react';

// ─── 광고 ID 설정 ──────────────────────
// 앱인토스 콘솔에서 발급받은 실제 배너 광고 ID
const IS_AD_PRODUCTION = true; // 실제 광고 노출 (출시 모드)
const TEST_BANNER_ID = 'ait-ad-test-banner-id';
const PROD_BANNER_ID = 'ait.v2.live.5c9eab2ff0f64a81';
const BANNER_AD_ID = IS_AD_PRODUCTION ? PROD_BANNER_ID : TEST_BANNER_ID;

// ─── TossAds 초기화 (1회만) ──────────────
let _tossAdsReady: Promise<boolean> | null = null;
function initTossAds(): Promise<boolean> {
  if (_tossAdsReady) return _tossAdsReady;
  _tossAdsReady = new Promise(async (resolve) => {
    try {
      const { TossAds } = await import('@apps-in-toss/web-framework');
      if (
        !TossAds?.initialize?.isSupported?.() ||
        !TossAds?.attachBanner?.isSupported?.()
      ) {
        resolve(false);
        return;
      }
      TossAds.initialize({
        callbacks: {
          onInitialized: () => resolve(true),
          onInitializationFailed: () => resolve(false),
        },
      });
      setTimeout(() => resolve(false), 5000);
    } catch {
      resolve(false);
    }
  });
  return _tossAdsReady;
}

interface BannerAdProps {
  style?: React.CSSProperties;
  className?: string;
}

/**
 * 배너 광고
 * - SDK 초기화 후 attachBanner로 DOM에 부착
 * - 광고 노출 실패 시 자동으로 영역 숨김 (return null)
 */
export default function BannerAd({ style, className = '' }: BannerAdProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [adLoaded, setAdLoaded] = useState(false);
  const [adFailed, setAdFailed] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    const el = containerRef.current;

    (async () => {
      const ok = await initTossAds();
      if (cancelled || !el) return;
      if (!ok) {
        setAdFailed(true);
        return;
      }

      try {
        const { TossAds } = await import('@apps-in-toss/web-framework');
        TossAds.attachBanner(BANNER_AD_ID, el, {
          theme: 'auto',
          tone: 'grey',
          variant: 'card',
          callbacks: {
            onAdRendered: () => {
              if (!cancelled) setAdLoaded(true);
            },
            onNoFill: () => {
              if (!cancelled) setAdFailed(true);
            },
            onAdFailedToRender: () => {
              if (!cancelled) setAdFailed(true);
            },
          },
        });
        if (!cancelled) setAdLoaded(true);
      } catch (e) {
        console.warn('[BannerAd] attach 실패:', e);
        if (!cancelled) setAdFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (adFailed) return null;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: '100%',
        minHeight: adLoaded ? 96 : 0,
        overflow: 'hidden',
        borderRadius: 14,
        ...style,
      }}
    />
  );
}