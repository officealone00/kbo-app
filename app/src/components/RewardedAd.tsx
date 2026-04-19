import { useEffect, useState } from 'react';

// ─── 광고 ID 설정 ──────────────────────
const IS_AD_PRODUCTION = true;
const TEST_REWARDED_ID = 'ait-ad-test-rewarded-id';
// TODO: 구글 반영 완료 후 실제 ID로 교체
const PROD_REWARDED_ID = 'ait.v2.live.YOUR_REWARDED_ID_HERE';
const AD_ID = IS_AD_PRODUCTION ? PROD_REWARDED_ID : TEST_REWARDED_ID;

// 개발 모드 감지 (로컬 브라우저에서 빠른 테스트용)
const IS_DEV = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || 
   window.location.hostname === '127.0.0.1');

interface Props {
  onReward: () => void;
  onClose: () => void;
}

/**
 * 리워드 광고
 * - 유저가 자발적으로 광고 시청
 * - 끝까지 보면 onReward() 콜백 발동 → 리포트 해금
 * - 중도 이탈 시 onClose()만 호출 → 보상 X
 * - 로컬 개발 환경: 3초 후 자동 해금 (테스트 편의)
 */
export default function RewardedAd({ onReward, onClose }: Props) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'playing' | 'error'>('loading');
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const cleanups: Array<() => void> = [];

    // ─── 로컬 개발: 3초 카운트다운 후 해금 ───
    if (IS_DEV) {
      setStatus('playing');
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            onReward();
            onClose();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      cleanups.push(() => clearInterval(interval));
      return () => cleanups.forEach((fn) => fn());
    }

    // ─── 토스 앱: 실제 SDK 호출 ───
    (async () => {
      try {
        const { loadRewardedAd, showRewardedAd } = await import(
          '@apps-in-toss/web-framework'
        );

        if (!loadRewardedAd || !showRewardedAd) {
          console.warn('[RewardedAd] SDK not supported');
          setStatus('error');
          setTimeout(() => {
            onReward();
            onClose();
          }, 1500);
          return;
        }

        const rm1 = loadRewardedAd({
          options: { adGroupId: AD_ID },
          onEvent: (event: any) => {
            if (event?.type !== 'loaded') return;
            setStatus('ready');

            const rm2 = showRewardedAd({
              options: { adGroupId: AD_ID },
              onEvent: (ev: any) => {
                setStatus('playing');
                if (ev?.type === 'rewarded' || ev?.type === 'reward_earned') {
                  onReward();
                }
                if (ev?.type === 'dismissed' || ev?.type === 'closed') {
                  onClose();
                }
              },
              onError: (err: any) => {
                console.warn('[RewardedAd] show error:', err);
                setStatus('error');
                onClose();
              },
            });
            if (rm2) cleanups.push(rm2);
          },
          onError: (err: any) => {
            console.warn('[RewardedAd] load error:', err);
            setStatus('error');
            setTimeout(() => {
              onReward();
              onClose();
            }, 1500);
          },
        });
        if (rm1) cleanups.push(rm1);
      } catch (e) {
        console.warn('[RewardedAd] fatal:', e);
        setStatus('error');
        setTimeout(() => {
          onReward();
          onClose();
        }, 1500);
      }
    })();

    // 10초 안전 타임아웃
    const timeout = setTimeout(() => {
      if (status === 'loading') {
        console.warn('[RewardedAd] timeout');
        onReward();
        onClose();
      }
    }, 10000);
    cleanups.push(() => clearTimeout(timeout));

    return () => {
      cleanups.forEach((fn) => {
        try {
          fn();
        } catch {}
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: 20,
          padding: 32,
          textAlign: 'center',
          maxWidth: 320,
          margin: '0 16px',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>
          {status === 'error' ? '⚠️' : '📊'}
        </div>
        <p style={{ fontSize: 16, fontWeight: 700, color: '#191F28', marginBottom: 8 }}>
          {IS_DEV && '[개발 모드] 광고 시뮬레이션'}
          {!IS_DEV && status === 'loading' && '광고를 준비하고 있어요'}
          {!IS_DEV && status === 'ready' && '광고가 곧 시작됩니다'}
          {!IS_DEV && status === 'playing' && '광고를 시청중이에요'}
          {!IS_DEV && status === 'error' && '잠시만 기다려주세요'}
        </p>
        <p style={{ fontSize: 13, color: '#8B95A1', lineHeight: 1.5 }}>
          {IS_DEV && countdown > 0 && (
            <>
              <span style={{ fontSize: 32, fontWeight: 800, color: '#3182F6' }}>
                {countdown}
              </span>
              <br />
              초 후 리포트가 열립니다
            </>
          )}
          {!IS_DEV && '광고 시청 후\n상세 분석 리포트를 확인할 수 있어요'.split('\n').map((line, i) => (
            <span key={i}>{line}<br /></span>
          ))}
        </p>
      </div>
    </div>
  );
}