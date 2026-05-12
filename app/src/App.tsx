import { useState, useEffect } from 'react';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import StandingsPage from '@/pages/StandingsPage';
import BattersPage from '@/pages/BattersPage';
import PitchersPage from '@/pages/PitchersPage';
import TeamReportPage from '@/pages/TeamReportPage';
import BottomNav from '@/components/BottomNav';
import FavoriteTeamModal from '@/components/FavoriteTeamModal';
import {
  hasOnboarded,
  markOnboarded,
  setFavoriteTeam,
} from '@/utils/storage';

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
  const location = useLocation();

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

  // 리포트 페이지에서는 하단 탭바 숨김 (몰입감 UP)
  const hideBottomNav = location.pathname === '/report';

  return (
    <>
      <BackButtonHandler />
      <div className="page-content">
        <Routes>
          <Route path="/" element={<StandingsPage />} />
          <Route path="/batters" element={<BattersPage />} />
          <Route path="/pitchers" element={<PitchersPage />} />
          <Route path="/report" element={<TeamReportPage />} />
        </Routes>
      </div>
      {!hideBottomNav && <BottomNav />}

      {/* 첫 진입 온보딩 */}
      {showOnboarding && (
        <FavoriteTeamModal
          currentTeam={null}
          isOnboarding
          onClose={() => setShowOnboarding(false)}
          onSelect={handleOnboardingSelect}
        />
      )}
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
