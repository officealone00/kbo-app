import { useEffect, useState } from 'react';
import { Heart, Settings, RefreshCw } from 'lucide-react';
import { api, type TeamStanding, type Meta } from '@/utils/api';
import { getFavoriteTeam, setFavoriteTeam } from '@/utils/storage';
import { getTeam } from '@/data/teams';
import BannerAd from '@/components/BannerAd';
import FavoriteTeamModal from '@/components/FavoriteTeamModal';
import TeamLogo from '@/components/TeamLogo';

export default function StandingsPage() {
  const [standings, setStandings] = useState<TeamStanding[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorite, setFavorite] = useState<string | null>(getFavoriteTeam());
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, m] = await Promise.all([api.standings(), api.meta().catch(() => null)]);
      setStandings(s);
      setMeta(m);
    } catch (e: any) {
      setError(e.message || '로딩 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleFavoriteSelect = (team: string | null) => {
    setFavorite(team);
    setFavoriteTeam(team);
  };

  return (
    <div className="min-h-screen bg-toss-gray-50">
      {/* Header */}
      <div className="px-5 pt-14 pb-4 flex items-end justify-between bg-white">
        <div>
          <h1 className="toss-title text-[26px]">⚾ KBO 순위</h1>
          <p className="toss-caption mt-1">
            {meta?.updatedAtKST ? `${meta.updatedAtKST.split(',')[0]} 업데이트` : `${meta?.season || new Date().getFullYear()} 시즌`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 rounded-full hover:bg-toss-gray-100"
            aria-label="새로고침"
          >
            <RefreshCw size={18} className={`text-toss-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="p-2 rounded-full hover:bg-toss-gray-100"
            aria-label="즐겨찾기 팀 설정"
          >
            {favorite ? (
              <Heart size={18} className="text-toss-red" fill="#FF3B30" />
            ) : (
              <Settings size={18} className="text-toss-gray-600" />
            )}
          </button>
        </div>
      </div>

      {/* Favorite team card */}
      {favorite && (
        <div className="px-5 mb-3 mt-2">
          <FavoriteTeamCard team={favorite} standings={standings} />
        </div>
      )}

      {/* 🎯 배너 #1 - 즐겨찾기 카드 아래 (최상단 노출용) */}
      {favorite && !loading && (
        <div className="px-5 mb-3">
          <BannerAd />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-5 mb-3 p-4 bg-toss-red/10 rounded-2xl">
          <p className="text-sm text-toss-red font-medium">
            데이터를 불러올 수 없어요
          </p>
          <p className="text-xs text-toss-gray-600 mt-1">{error}</p>
          <button
            onClick={load}
            className="mt-2 text-sm text-toss-blue font-semibold"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && !standings.length && (
        <div className="px-5">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-14 bg-white rounded-xl mb-2 animate-pulse" />
          ))}
        </div>
      )}

      {/* Standings table */}
      {!loading && standings.length > 0 && (
        <div className="px-5 pb-4">
          <div className="bg-white rounded-toss shadow-toss overflow-hidden">
            {/* Header row */}
            <div
              className="grid items-center text-[11px] font-semibold text-toss-gray-500 px-3 py-2 bg-toss-gray-50 border-b border-toss-gray-100"
              style={{ gridTemplateColumns: '28px 1fr 36px 36px 36px 48px 48px' }}
            >
              <span className="text-center">순위</span>
              <span>팀</span>
              <span className="text-right">승</span>
              <span className="text-right">무</span>
              <span className="text-right">패</span>
              <span className="text-right">승률</span>
              <span className="text-right">게임차</span>
            </div>

            {standings.map((s, idx) => {
              const info = getTeam(s.team);
              const isFav = s.team === favorite;
              return (
                <div key={s.team}>
                  <div
                    className="grid items-center px-3 py-3 border-b border-toss-gray-100 last:border-b-0"
                    style={{
                      gridTemplateColumns: '28px 1fr 36px 36px 36px 48px 48px',
                      backgroundColor: isFav ? info.bgLight : 'transparent',
                    }}
                  >
                    <div className="text-center">
                      <span
                        className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                        style={{
                          backgroundColor: s.rank <= 5 ? info.color : '#E5E8EB',
                          color: s.rank <= 5 ? 'white' : '#8B95A1',
                        }}
                      >
                        {s.rank}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <TeamLogo team={s.team} size={28} />
                      <div className="min-w-0">
                        <p
                          className="font-bold text-sm truncate"
                          style={{ color: isFav ? info.color : '#191F28' }}
                        >
                          {s.team}
                          {isFav && ' ❤️'}
                        </p>
                        <p className="text-[10px] text-toss-gray-500 truncate">
                          최근 {s.last10} · {s.streak}
                        </p>
                      </div>
                    </div>
                    <span className="text-right text-sm font-semibold text-toss-gray-800">
                      {s.wins}
                    </span>
                    <span className="text-right text-sm text-toss-gray-600">
                      {s.draws}
                    </span>
                    <span className="text-right text-sm text-toss-gray-600">
                      {s.losses}
                    </span>
                    <span className="text-right text-sm font-semibold text-toss-gray-800 tabular-nums">
                      {s.winRate.toFixed(3)}
                    </span>
                    <span className="text-right text-sm text-toss-gray-600 tabular-nums">
                      {s.gamesBehind === 0 ? '-' : s.gamesBehind}
                    </span>
                  </div>

                  {/* 🎯 배너 #2 - 5위와 6위 사이 인라인 (스크롤 중간 노출) */}
                  {idx === 4 && (
                    <div className="px-3 py-3 bg-toss-gray-50 border-b border-toss-gray-100">
                      <BannerAd />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 🎯 배너 #3 - 순위표 하단 (기존 위치) */}
      <div className="px-5 mb-4">
        <BannerAd />
      </div>

      {/* 즐겨찾기 CTA (아직 설정 안했을 때) */}
      {!favorite && !loading && (
        <div className="px-5 mb-6">
          <button
            onClick={() => setShowModal(true)}
            className="w-full bg-gradient-to-r from-toss-blue to-blue-500 text-white rounded-2xl p-4 flex items-center justify-between"
          >
            <div className="text-left">
              <p className="text-sm opacity-90">⭐ 나의 응원팀은?</p>
              <p className="font-bold mt-0.5">즐겨찾는 팀 설정하기</p>
            </div>
            <Heart size={24} />
          </button>
        </div>
      )}

      {showModal && (
        <FavoriteTeamModal
          currentTeam={favorite}
          onClose={() => setShowModal(false)}
          onSelect={handleFavoriteSelect}
        />
      )}
    </div>
  );
}

// ─── 즐겨찾기 팀 카드 (상단 하이라이트) ───
function FavoriteTeamCard({
  team,
  standings,
}: {
  team: string;
  standings: TeamStanding[];
}) {
  const info = getTeam(team);
  const stats = standings.find((s) => s.team === team);
  if (!stats) return null;

  return (
    <div
      className="rounded-toss p-4 text-white relative overflow-hidden"
      style={{ backgroundColor: info.color }}
    >
      <div
        className="absolute -right-4 -top-4 opacity-20"
        style={{ fontSize: 80 }}
      >
        {info.emoji}
      </div>
      <div className="relative">
        <div className="flex items-center gap-2 mb-1">
          <Heart size={14} fill="white" />
          <span className="text-xs font-semibold opacity-90">나의 응원팀</span>
        </div>
        <p className="text-2xl font-bold mb-1">
          {info.fullName}
        </p>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-extrabold">{stats.rank}위</span>
          <span className="text-sm opacity-80">
            {stats.wins}승 {stats.draws}무 {stats.losses}패 · 승률 {stats.winRate.toFixed(3)}
          </span>
        </div>
        <p className="text-xs opacity-80 mt-1">
          {stats.gamesBehind === 0 ? '선두!' : `1위와 ${stats.gamesBehind}게임차`} · {stats.streak}
        </p>
      </div>
    </div>
  );
}