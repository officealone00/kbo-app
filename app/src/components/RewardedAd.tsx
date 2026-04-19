import { useEffect, useState } from 'react';

// ─── 광고 ID 설정 ──────────────────────
// 앱인토스 콘솔에서 발급받은 실제 리워드 광고 ID
const IS_AD_PRODUCTION = true;
const TEST_REWARDED_ID = 'ait-ad-test-rewarded-id';
// TODO: 구글 반영 완료 후 실제 ID로 교체
const PROD_REWARDED_ID = 'ait.v2.live.YOUR_REWARDED_ID_HERE';
const AD_ID = IS_AD_PRODUCTION ? PROD_REWARDED_ID : TEST_REWARDED_ID;

interface Props {
  onReward: () => void;  // 광고 끝까지 봤을 때 호출
  onClose: () => void;   // 모달 닫을 때 호출
}

/**
 * 리워드 광고
 * - 유저가 자발적으로 광고 시청
 * - 끝까지 보면 onReward() 콜백 발동 → 리포트 해금
 * - 중도 이탈 시 onClose()만 호출 → 보상 X
 */
export default function RewardedAd({ onReward, onClose }: Props) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'playing' | 'error'>('loading');

  useEffect(() => {
    const cleanups: Array<() => void> = [];

    (async () => {
      try {
        const { loadRewardedAd, showRewardedAd } = await import(
          '@apps-in-toss/web-framework'
        );

        if (!loadRewardedAd || !showRewardedAd) {
          console.warn('[RewardedAd] SDK not supported');
          setStatus('error');
          // 개발/테스트 환경에서는 광고 없이 바로 보상 지급
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

            // 광고 자동 재생
            const rm2 = showRewardedAd({
              options: { adGroupId: AD_ID },
              onEvent: (ev: any) => {
                setStatus('playing');

                // 광고 끝까지 본 경우
                if (ev?.type === 'rewarded' || ev?.type === 'reward_earned') {
                  onReward();
                }

                // 광고 닫힘 (끝까지 봤든 중간에 닫았든)
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
            // 로드 실패 시 보상 지급 (유저 경험 우선)
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
          {status === 'loading' && '광고를 준비하고 있어요'}
          {status === 'ready' && '광고가 곧 시작됩니다'}
          {status === 'playing' && '광고를 시청중이에요'}
          {status === 'error' && '잠시만 기다려주세요'}
        </p>
        <p style={{ fontSize: 13, color: '#8B95A1', lineHeight: 1.5 }}>
          광고 시청 후<br />상세 분석 리포트를 확인할 수 있어요
        </p>
      </div>
    </div>
  );
}