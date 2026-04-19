import { useState, useEffect } from 'react';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
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
// 이 앱은 탭이 4개뿐이라 5회 주기가 적정 (8회는 너무 드물어서 수익성↓)
const INTERSTITIAL_INTERVAL = 5;

export default function App() {
  // MemoryRouter: 앱인토스 웹뷰의 뒤로가기 버튼과 브라우저 히스토리 충돌 방지
  return (
    <MemoryRouter initialEntries={['/']}>
      <AppShell />
    </MemoryRouter>
  );
}

function AppShell() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showInterstitial, setShowInterstitial] = useState(false);

  // 첫 진입 시 온보딩 모달
  useEffect(() => {
    if (!hasOnboarded()) {
      const t = setTimeout(() => setShowOnboarding(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const handleOnboardingSelect = (team: string | null) => {
    setFavoriteTeam(team);
    markOnboarded();
  };

  return (
    <>
      <BackButtonHandler />
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
    </>
  );
}

// ─── 앱인토스 뒤로가기 통합 처리 ───
// - 홈(/)이 아니면: 홈으로 이동
// - 홈(/)이면: 토스 웹뷰가 자동으로 앱 종료 처리
function BackButtonHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleBack = (e: PopStateEvent) => {
      if (location.pathname !== '/') {
        e.preventDefault();
        navigate('/', { replace: true });
        window.history.pushState(null, '', window.location.href);
      }
      // 루트에서는 별도 처리 X → 앱인토스 웹뷰가 앱 종료 처리
    };

    window.addEventListener('popstate', handleBack);
    // 초기 스택 고정 (뒤로가기 첫 입력 방어)
    window.history.pushState(null, '', window.location.href);

    return () => window.removeEventListener('popstate', handleBack);
  }, [location.pathname, navigate]);

  return null;
}

// ─── 탭 네비게이션 클릭을 카운트해서 N번에 1회 전면광고 표시 ───
function GlobalClickTracker({ onShouldShowAd }: { onShouldShowAd: () => void }) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const navButton = target.closest('.bottom-nav-item');
      if (!navButton) return;

      const count = incrementInterstitialCount();
      if (count > 0 && count % INTERSTITIAL_INTERVAL === 0) {
        setTimeout(() => onShouldShowAd(), 300);
      }
    };

    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [onShouldShowAd]);

  return null;
}