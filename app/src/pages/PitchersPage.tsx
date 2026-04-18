import { useEffect, useMemo, useState } from 'react';
import { api, type Pitcher, type PitchersData } from '@/utils/api';
import { getFavoriteTeam } from '@/utils/storage';
import { TEAM_NAMES, getTeam } from '@/data/teams';
import BannerAd from '@/components/BannerAd';
import TeamBadge from '@/components/TeamBadge';

type Category = 'era' | 'w' | 'so' | 'sv';
type Role = 'all' | '선발' | '불펜' | '마무리';

const CATEGORIES: { key: Category; label: string; unit: string }[] = [
  { key: 'era', label: '방어율', unit: '' },
  { key: 'w', label: '승', unit: '승' },
  { key: 'so', label: '삼진', unit: 'K' },
  { key: 'sv', label: '세이브', unit: 'SV' },
];

export default function PitchersPage() {
  const [data, setData] = useState<PitchersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cat, setCat] = useState<Category>('era');
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<Role>('all');
  const favorite = getFavoriteTeam();

  useEffect(() => {
    (async () => {
      try {
        const d = await api.pitchers();
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
    let list: Pitcher[] = data[cat] || [];
    if (teamFilter) list = list.filter((p) => p.team === teamFilter);
    if (roleFilter !== 'all') list = list.filter((p) => p.role === roleFilter);
    return list;
  }, [data, cat, teamFilter, roleFilter]);

  const formatValue = (p: Pitcher) => {
    switch (cat) {
      case 'era':
        return p.era.toFixed(2);
      case 'w':
        return String(p.w);
      case 'so':
        return String(p.so);
      case 'sv':
        return String(p.sv);
    }
  };

  return (
    <div className="min-h-screen bg-toss-gray-50">
      {/* Header */}
      <div className="px-5 pt-14 pb-3 bg-white">
        <h1 className="toss-title text-[24px]">⚾ 투수 순위</h1>
        <p className="toss-caption mt-1">Top 30 · 카테고리/역할별 정렬</p>
      </div>

      {/* Category tabs */}
      <div className="px-5 py-3 bg-white">
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

      {/* Role filter */}
      <div className="px-5 pb-3 bg-white border-b border-toss-gray-100">
        <div className="flex gap-2">
          {(['all', '선발', '불펜', '마무리'] as Role[]).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                backgroundColor: roleFilter === r ? '#3182F6' : '#F2F4F6',
                color: roleFilter === r ? 'white' : '#4E5968',
              }}
            >
              {r === 'all' ? '전체' : r}
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
            label="전체 팀"
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
            <p className="text-toss-gray-600">해당 조건의 선수가 없어요</p>
          </div>
        )}

        <div className="space-y-2">
          {rows.map((p, i) => (
            <div key={`${p.name}-${i}`}>
              <PitcherRow pitcher={p} value={formatValue(p)} category={cat} />
              {i === 9 && (
                <div className="my-3">
                  <BannerAd />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

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

function PitcherRow({
  pitcher,
  value,
  category,
}: {
  pitcher: Pitcher;
  value: string;
  category: Category;
}) {
  const info = getTeam(pitcher.team);
  const favorite = getFavoriteTeam();
  const isFav = pitcher.team === favorite;
  const unit = CATEGORIES.find((c) => c.key === category)?.unit || '';

  const roleColor = {
    선발: '#3182F6',
    불펜: '#FF9500',
    마무리: '#FF3B30',
  }[pitcher.role];

  return (
    <div
      className="bg-white rounded-xl px-3 py-3 flex items-center gap-3"
      style={{
        border: isFav ? `2px solid ${info.color}` : '2px solid transparent',
      }}
    >
      <div className="w-8 text-center flex-shrink-0">
        <span
          className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
          style={{
            backgroundColor: pitcher.rank <= 3 ? info.color : '#F2F4F6',
            color: pitcher.rank <= 3 ? 'white' : '#8B95A1',
          }}
        >
          {pitcher.rank}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-bold text-toss-gray-900 truncate">{pitcher.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <TeamBadge team={pitcher.team} size="sm" />
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: `${roleColor}15`,
              color: roleColor,
            }}
          >
            {pitcher.role}
          </span>
          <span className="text-[11px] text-toss-gray-500">
            {pitcher.g}경기
          </span>
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <p className="text-xl font-extrabold tabular-nums" style={{ color: info.color }}>
          {value}
          <span className="text-xs font-medium text-toss-gray-500 ml-0.5">{unit}</span>
        </p>
        <p className="text-[10px] text-toss-gray-400 mt-0.5">
          {category !== 'era' && `ERA ${pitcher.era.toFixed(2)}`}
          {category === 'era' && `${pitcher.w}승 ${pitcher.l ?? 0}패`}
        </p>
      </div>
    </div>
  );
}
