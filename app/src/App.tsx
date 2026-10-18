import { useState } from 'react';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import StandingsPage from '@/pages/StandingsPage';
import BattersPage from '@/pages/BattersPage';
import PitchersPage from '@/pages/PitchersPage';
import GamesPage from '@/pages/GamesPage';
import TeamReportPage from '@/pages/TeamReportPage';
import BottomNav from '@/components/BottomNav';
import { useTossBackEvent } from '@/hooks/useTossBackEvent';
import FavoriteTeamModal from '@/components/FavoriteTeamModal';
import {
  markOnboarded,
  setFavoriteTeam,
} from '@/utils/storage';

export default function App() {
  // MemoryRouter + useTossBackEvent: 토스 뒤로가기 → 이전 화면, 첫 화면에서만 미니앱 종료
  return (
    <MemoryRouter initialEntries={['/']}>
      <AppShell />
    </MemoryRouter>
  );
}

function AppShell() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // ─── 앱인토스 뒤로가기 (내비게이션 바 + 안드로이드 시스템 뒤로가기) ───
  // - 온보딩 모달이 열려 있으면: 모달만 닫기
  // - 이전 화면이 있으면: 이전 화면으로 이동
  // - 첫 화면이면: 미니앱 종료(closeView)
  useTossBackEvent(() => {
    if (showOnboarding) {
      setShowOnboarding(false);
      return true;
    }
    if (location.key !== 'default') {
      navigate(-1);
      return true;
    }
    return false;
  });

  // (2026-10-18) 진입 직후 자동으로 뜨던 응원팀 선택 바텀시트는 제거했다.
  // 정책: "진입 직후 바텀시트가 자동으로 뜨지 않아야 해요" → 순위 화면 안의 CTA로 직접 고르게 한다.

  const handleOnboardingSelect = (team: string | null) => {
    setFavoriteTeam(team);
    markOnboarded();
  };

  // 리포트 페이지에서는 하단 탭바 숨김 (몰입감 UP)
  const hideBottomNav = location.pathname === '/report';

  return (
    <>
      <div className="page-content">
        <Routes>
          <Route path="/" element={<StandingsPage />} />
          <Route path="/batters" element={<BattersPage />} />
          <Route path="/pitchers" element={<PitchersPage />} />
          <Route path="/games" element={<GamesPage />} />
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

