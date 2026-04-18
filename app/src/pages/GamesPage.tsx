import { useEffect, useState } from 'react';
import { api, type Game, type GamesData } from '@/utils/api';
import { getFavoriteTeam } from '@/utils/storage';
import { getTeam } from '@/data/teams';
import BannerAd from '@/components/BannerAd';

type Tab = 'today' | 'yesterday';

export default function GamesPage() {
  const [data, setData] = useState<GamesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('today');
  const favorite = getFavoriteTeam();

  useEffect(() => {
    (async () => {
      try {
        const d = await api.games();
        setData(d);
      } catch (e: any) {
        setError(e.message || '로딩 실패');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const current = data?.[tab];
  const games = current?.games || [];
  const formatDate = (yyyymmdd?: string) => {
    if (!yyyymmdd) return '';
    return `${yyyymmdd.slice(4, 6)}.${yyyymmdd.slice(6, 8)}`;
  };

  // 즐겨찾기 팀 경기 먼저
  const sorted = favorite
    ? [
        ...games.filter((g) => g.home === favorite || g.away === favorite),
        ...games.filter((g) => g.home !== favorite && g.away !== favorite),
      ]
    : games;

  return (
    <div className="min-h-screen bg-toss-gray-50">
      {/* Header */}
      <div className="px-5 pt-14 pb-3 bg-white">
        <h1 className="toss-title text-[24px]">📅 경기 결과</h1>
        <p className="toss-caption mt-1">오늘 · 어제 경기</p>
      </div>

      {/* Tabs */}
      <div className="px-5 py-3 bg-white border-b border-toss-gray-100">
        <div className="flex gap-1.5 bg-toss-gray-100 rounded-xl p-1">
          {(['today', 'yesterday'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{
                backgroundColor: tab === t ? 'white' : 'transparent',
                color: tab === t ? '#191F28' : '#8B95A1',
                boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {t === 'today' ? '🔵 오늘' : '📆 어제'}
              {data && (
                <span className="ml-1.5 text-[11px] opacity-60">
                  {formatDate(data[t]?.date)}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-4">
        {error && (
          <div className="p-4 bg-toss-red/10 rounded-2xl mb-3">
            <p className="text-sm text-toss-red">{error}</p>
          </div>
        )}

        {loading && (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {!loading && games.length === 0 && (
          <div className="text-center py-12 bg-white rounded-toss">
            <p className="text-5xl mb-3">🏟️</p>
            <p className="text-toss-gray-700 font-semibold mb-1">
              {tab === 'today' ? '오늘 경기가 없어요' : '어제 경기가 없어요'}
            </p>
            <p className="text-xs text-toss-gray-500">휴식일이거나 정보를 불러올 수 없어요</p>
          </div>
        )}

        {!loading && sorted.length > 0 && (
          <div className="space-y-2">
            {sorted.map((g, i) => (
              <div key={i}>
                <GameCard game={g} favorite={favorite} />
                {i === 2 && (
                  <div className="my-3">
                    <BannerAd />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {!loading && games.length > 0 && (
        <div className="px-5 pb-6">
          <BannerAd />
        </div>
      )}
    </div>
  );
}

function GameCard({ game, favorite }: { game: Game; favorite: string | null }) {
  const home = getTeam(game.home);
  const away = getTeam(game.away);
  const isDone = game.status === '종료' && game.homeScore != null;
  const isFavGame = favorite && (game.home === favorite || game.away === favorite);

  const homeWin = isDone && (game.homeScore ?? 0) > (game.awayScore ?? 0);
  const awayWin = isDone && (game.awayScore ?? 0) > (game.homeScore ?? 0);

  return (
    <div
      className="bg-white rounded-toss p-4"
      style={{
        border: isFavGame ? '2px solid #3182F6' : '2px solid transparent',
      }}
    >
      {isFavGame && (
        <p className="text-[11px] font-bold text-toss-blue mb-2">❤️ 내 팀 경기</p>
      )}

      <div className="flex items-center justify-between">
        {/* Away */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-2xl">{away.emoji}</span>
          <div className="min-w-0">
            <p
              className="font-bold text-sm truncate"
              style={{ color: awayWin ? away.color : '#191F28' }}
            >
              {game.away}
            </p>
            <p className="text-[10px] text-toss-gray-500">원정</p>
          </div>
        </div>

        {/* Score / Time */}
        <div className="mx-4 text-center">
          {isDone ? (
            <div className="flex items-center gap-2 text-2xl font-extrabold tabular-nums">
              <span style={{ color: awayWin ? away.color : '#B0B8C1' }}>
                {game.awayScore}
              </span>
              <span className="text-toss-gray-300 text-base">:</span>
              <span style={{ color: homeWin ? home.color : '#B0B8C1' }}>
                {game.homeScore}
              </span>
            </div>
          ) : game.status === '예정' ? (
            <div>
              <p className="text-sm font-semibold text-toss-gray-800">
                {game.time || 'vs'}
              </p>
              <p className="text-[10px] text-toss-gray-500">예정</p>
            </div>
          ) : (
            <p className="text-xs text-toss-gray-500">{game.status}</p>
          )}
          {game.stadium && (
            <p className="text-[10px] text-toss-gray-400 mt-0.5">{game.stadium}</p>
          )}
        </div>

        {/* Home */}
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <div className="min-w-0 text-right">
            <p
              className="font-bold text-sm truncate"
              style={{ color: homeWin ? home.color : '#191F28' }}
            >
              {game.home}
            </p>
            <p className="text-[10px] text-toss-gray-500">홈</p>
          </div>
          <span className="text-2xl">{home.emoji}</span>
        </div>
      </div>

      {/* Winner badge */}
      {isDone && (
        <div className="mt-2 pt-2 border-t border-toss-gray-100 text-center">
          <span
            className="text-[11px] font-bold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: homeWin ? home.bgLight : away.bgLight,
              color: homeWin ? home.color : away.color,
            }}
          >
            🏆 {homeWin ? game.home : game.away} 승
          </span>
        </div>
      )}
    </div>
  );
}
