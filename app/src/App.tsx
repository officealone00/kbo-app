import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import StandingsPage from '@/pages/StandingsPage';
import BattersPage from '@/pages/BattersPage';
import PitchersPage from '@/pages/PitchersPage';
import GamesPage from '@/pages/GamesPage';
import BottomNav from '@/components/BottomNav';
import FavoriteTeamModal from '@/components/FavoriteTeamModal';
import InterstitialAd from '@/components/InterstitialAd';
import {
  hasOnboarded,
  markOnboarded,
  setFavoriteTeam,
  incrementInterstitialCount,
  resetInterstitialCount,
} from '@/utils/storage';

// 몇 번 탭 이동마다 전면광고를 띄울지
const INTERSTITIAL_INTERVAL = 8;

export default function App() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showInterstitial, setShowInterstitial] = useState(false);

  // 첫 진입 시 온보딩 모달
  useEffect(() => {
    if (!hasOnboarded()) {
      // 살짝 딜레이 주고 표시
      const t = setTimeout(() => setShowOnboarding(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  // 라우트 변경 감지 → 전면광고 카운터
  // (BrowserRouter 내부에서만 useLocation 사용 가능하므로 RouterContent로 분리)

  const handleOnboardingSelect = (team: string | null) => {
    setFavoriteTeam(team);
    markOnboarded();
  };

  return (
    <BrowserRouter>
      <div className="page-content">
        <Routes>
          <Route path="/" element={<StandingsPage />} />
          <Route path="/batters" element={<BattersPage />} />
          <Route path="/pitchers" element={<PitchersPage />} />
          <Route path="/games" element={<GamesPage />} />
        </Routes>
      </div>
      <BottomNav />

      {/* 전면광고 */}
      {showInterstitial && (
        <InterstitialAd
          onClose={() => setShowInterstitial(false)}
          onComplete={() => resetInterstitialCount()}
        />
      )}

      {/* 첫 진입 온보딩 */}
      {showOnboarding && (
        <FavoriteTeamModal
          currentTeam={null}
          isOnboarding
          onClose={() => setShowOnboarding(false)}
          onSelect={handleOnboardingSelect}
        />
      )}

      {/* 전역 탭 클릭 리스너 → 전면광고 트리거 */}
      <GlobalClickTracker
        onShouldShowAd={() => setShowInterstitial(true)}
      />
    </BrowserRouter>
  );
}

// ─── 탭 네비게이션 클릭을 카운트해서 N번에 1회 전면광고 표시 ───
function GlobalClickTracker({ onShouldShowAd }: { onShouldShowAd: () => void }) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // 하단 네비게이션 클릭만 감지
      const navButton = target.closest('.bottom-nav-item');
      if (!navButton) return;

      const count = incrementInterstitialCount();
      if (count > 0 && count % INTERSTITIAL_INTERVAL === 0) {
        // 짧은 딜레이 후 광고 표시
        setTimeout(() => onShouldShowAd(), 300);
      }
    };

    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [onShouldShowAd]);

  return null;
}
