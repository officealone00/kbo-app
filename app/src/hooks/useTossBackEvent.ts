import { useEffect, useRef } from 'react';

/**
 * 앱인토스 뒤로가기 처리 (2026-10-18 정책 대응)
 *
 * - 토스 내비게이션 바의 뒤로가기 버튼, 안드로이드 시스템 뒤로가기를 모두 받는다.
 * - onBack() 이 true 를 돌려주면 앱 안에서 처리(이전 화면으로 이동)한 것으로 보고 끝낸다.
 * - false 를 돌려주면 첫 화면이라는 뜻이므로 closeView() 로 미니앱을 종료한다.
 *
 * 토스 밖(로컬 브라우저 개발 환경)에서는 SDK 가 없으므로 조용히 무시한다.
 */
export function useTossBackEvent(onBack: () => boolean) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const sdk: any = await import('@apps-in-toss/web-framework');
        if (cancelled) return;
        // SDK 3.x: Screen.close / 2.x: closeView
        const closeApp: () => Promise<void> = sdk.Screen?.close ?? sdk.closeView;
        unsubscribe = sdk.graniteEvent.addEventListener('backEvent', {
          onEvent: () => {
            const handled = onBackRef.current();
            if (!handled) {
              closeApp().catch((e: unknown) => console.warn('[backEvent] 미니앱 종료 실패', e));
            }
          },
          onError: (e: Error) => console.warn('[backEvent] 오류', e),
        });
      } catch (e) {
        console.warn('[backEvent] 토스 환경이 아니어서 뒤로가기 연동을 건너뜀', e);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);
}
