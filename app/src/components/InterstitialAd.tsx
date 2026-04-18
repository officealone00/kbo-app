import { useEffect, useState } from 'react';

const IS_AD_PRODUCTION = false;
const TEST_INTERSTITIAL_ID = 'ait-ad-test-interstitial-id';
const PROD_INTERSTITIAL_ID = 'ait.v2.live.YOUR_INTERSTITIAL_ID_HERE';
const AD_ID = IS_AD_PRODUCTION ? PROD_INTERSTITIAL_ID : TEST_INTERSTITIAL_ID;

interface Props {
  onClose: () => void;
  onComplete: () => void;
}

/**
 * 전면 광고
 * loadFullScreenAd → 'loaded' → showFullScreenAd → 'dismissed' → onComplete
 * 8초 타임아웃 안전장치 포함 (SDK 응답 없을 때 자동 스킵)
 */
export default function InterstitialAd({ onClose, onComplete }: Props) {
  const [sdkMode, setSdkMode] = useState<string | null>(null);

  useEffect(() => {
    const cleanups: Array<() => void> = [];

    (async () => {
      try {
        const { loadFullScreenAd, showFullScreenAd } = await import(
          '@apps-in-toss/web-framework'
        );
        if (!loadFullScreenAd || !showFullScreenAd) {
          onComplete();
          onClose();
          setSdkMode('skip');
          return;
        }

        const rm1 = loadFullScreenAd({
          options: { adGroupId: AD_ID },
          onEvent: (event: any) => {
            if (event?.type !== 'loaded') return;
            const rm2 = showFullScreenAd({
              options: { adGroupId: AD_ID },
              onEvent: (ev: any) => {
                if (ev?.type === 'dismissed' || ev?.type === 'completed') {
                  onComplete();
                  onClose();
                  setSdkMode('sdk');
                }
              },
              onError: () => {
                onComplete();
                onClose();
                setSdkMode('skip');
              },
            });
            if (rm2) cleanups.push(rm2);
          },
          onError: () => {
            onComplete();
            onClose();
            setSdkMode('skip');
          },
        });
        if (rm1) cleanups.push(rm1);
      } catch {
        onComplete();
        onClose();
        setSdkMode('skip');
      }
    })();

    // 8초 안전 타임아웃
    const t = setTimeout(() => {
      if (sdkMode === null) {
        onComplete();
        onClose();
        setSdkMode('skip');
      }
    }, 8000);
    cleanups.push(() => clearTimeout(t));

    return () => {
      cleanups.forEach((fn) => {
        try {
          fn();
        } catch {}
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (sdkMode === 'sdk' || sdkMode === 'skip') return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
      }}
    >
      <p style={{ color: '#fff', fontSize: 14 }}>잠시만 기다려주세요...</p>
    </div>
  );
}
