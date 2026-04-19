import { useEffect, useMemo, useState } from 'react';
import { api, type Batter, type BattersData } from '@/utils/api';
import { getFavoriteTeam } from '@/utils/storage';
import { TEAM_NAMES, getTeam } from '@/data/teams';
import BannerAd from '@/components/BannerAd';
import TeamBadge from '@/components/TeamBadge';

type Category = 'avg' | 'hr' | 'rbi' | 'sb';

const CATEGORIES: { key: Category; label: string; unit: string }[] = [
  { key: 'avg', label: '타율', unit: '' },
  { key: 'hr', label: '홈런', unit: '개' },
  { key: 'rbi', label: '타점', unit: '점' },
  { key: 'sb', label: '도루', unit: '개' },
];

export default function BattersPage() {
  const [data, setData] = useState<BattersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cat, setCat] = useState<Category>('avg');
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const favorite = getFavoriteTeam();

  useEffect(() => {
    (async () => {
      try {
        const d = await api.batters();
        setData(d);
      } catch (e: any) {
        setError(e.message || '로딩 실패');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    let list: Batter[] = data[cat] || [];
    if (teamFilter) list = list.filter((b) => b.team === teamFilter);
    return list;
  }, [data, cat, teamFilter]);

  const formatValue = (b: Batter) => {
    switch (cat) {
      case 'avg':
        return b.avg.toFixed(3);
      case 'hr':
        return String(b.hr);
      case 'rbi':
        return String(b.rbi);
      case 'sb':
        return String(b.sb ?? 0);
    }
  };

  return (
    <div className="min-h-screen bg-toss-gray-50">
      {/* Header */}
      <div className="px-5 pt-14 pb-3 bg-white">
        <h1 className="toss-title text-[24px]">🏏 타자 순위</h1>
        <p className="toss-caption mt-1">Top 30 · 카테고리별 정렬</p>
      </div>

      {/* Category tabs */}
      <div className="px-5 py-3 bg-white border-b border-toss-gray-100">
        <div className="flex gap-1.5 bg-toss-gray-100 rounded-xl p-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCat(c.key)}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                backgroundColor: cat === c.key ? 'white' : 'transparent',
                color: cat === c.key ? '#191F28' : '#8B95A1',
                boxShadow: cat === c.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Team filter */}
      <div className="bg-white border-b border-toss-gray-100">
        <div className="flex gap-2 overflow-x-auto hide-scrollbar px-5 py-3">
          <TeamChip
            active={teamFilter === null}
            onClick={() => setTeamFilter(null)}
            label="전체"
          />
          {favorite && (
            <TeamChip
              active={teamFilter === favorite}
              onClick={() => setTeamFilter(teamFilter === favorite ? null : favorite)}
              label={`❤️ ${favorite}`}
              color={getTeam(favorite).color}
            />
          )}
          {TEAM_NAMES.filter((t) => t !== favorite).map((team) => {
            const info = getTeam(team);
            return (
              <TeamChip
                key={team}
                active={teamFilter === team}
                onClick={() => setTeamFilter(teamFilter === team ? null : team)}
                label={`${info.emoji} ${team}`}
                color={info.color}
              />
            );
          })}
        </div>
      </div>

      {/* 🎯 배너 #1 - 필터 바로 아래 (최상단) */}
      {!loading && rows.length > 0 && (
        <div className="px-5 pt-3">
          <BannerAd />
        </div>
      )}

      {/* Content */}
      <div className="px-5 py-4">
        {error && (
          <div className="p-4 bg-toss-red/10 rounded-2xl mb-3">
            <p className="text-sm text-toss-red">{error}</p>
          </div>
        )}

        {loading && (
          <div>
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-16 bg-white rounded-xl mb-2 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div className="text-center py-12">
            <p className="text-5xl mb-3">🤷</p>
            <p className="text-toss-gray-600">
              {teamFilter ? `${teamFilter}의 Top 30 선수가 없어요` : '데이터가 없어요'}
            </p>
          </div>
        )}

        <div className="space-y-2">
          {rows.map((b, i) => (
            <div key={`${b.name}-${i}`}>
              <BatterRow batter={b} value={formatValue(b)} category={cat} />
              {/* 🎯 배너 #2 - 5위와 6위 사이 (스크롤 초입) */}
              {i === 4 && (
                <div className="my-3">
                  <BannerAd />
                </div>
              )}
              {/* 🎯 배너 #3 - 15위와 16위 사이 (스크롤 중반) */}
              {i === 14 && (
                <div className="my-3">
                  <BannerAd />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 🎯 배너 #4 - 하단 (기존 유지) */}
      {!loading && rows.length > 0 && (
        <div className="px-5 pb-6">
          <BannerAd />
        </div>
      )}
    </div>
  );
}

function TeamChip({
  active,
  onClick,
  label,
  color = '#3182F6',
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all"
      style={{
        backgroundColor: active ? color : '#F2F4F6',
        color: active ? 'white' : '#4E5968',
      }}
    >
      {label}
    </button>
  );
}

function BatterRow({
  batter,
  value,
  category,
}: {
  batter: Batter;
  value: string;
  category: Category;
}) {
  const info = getTeam(batter.team);
  const favorite = getFavoriteTeam();
  const isFav = batter.team === favorite;
  const unit = CATEGORIES.find((c) => c.key === category)?.unit || '';

  return (
    <div
      className="bg-white rounded-xl px-3 py-3 flex items-center gap-3"
      style={{
        border: isFav ? `2px solid ${info.color}` : '2px solid transparent',
      }}
    >
      {/* Rank */}
      <div className="w-8 text-center flex-shrink-0">
        <span
          className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
          style={{
            backgroundColor: batter.rank <= 3 ? info.color : '#F2F4F6',
            color: batter.rank <= 3 ? 'white' : '#8B95A1',
          }}
        >
          {batter.rank}
        </span>
      </div>

      {/* Name + Team */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-toss-gray-900 truncate">{batter.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <TeamBadge team={batter.team} size="sm" />
          <span className="text-[11px] text-toss-gray-500">
            {batter.games ?? 0}경기
          </span>
        </div>
      </div>

      {/* Value */}
      <div className="text-right flex-shrink-0">
        <p className="text-xl font-extrabold tabular-nums" style={{ color: info.color }}>
          {value}
          <span className="text-xs font-medium text-toss-gray-500 ml-0.5">{unit}</span>
        </p>
        {category === 'avg' && (
          <p className="text-[10px] text-toss-gray-400 mt-0.5">
            {batter.h ?? '-'}안타 / {batter.ab ?? '-'}타수
          </p>
        )}
        {category === 'hr' && (
          <p className="text-[10px] text-toss-gray-400 mt-0.5">
            타율 {batter.avg.toFixed(3)}
          </p>
        )}
        {category === 'rbi' && (
          <p className="text-[10px] text-toss-gray-400 mt-0.5">
            타율 {batter.avg.toFixed(3)}
          </p>
        )}
        {category === 'sb' && (
          <p className="text-[10px] text-toss-gray-400 mt-0.5">
            타율 {batter.avg.toFixed(3)}
          </p>
        )}
      </div>
    </div>
  );
}