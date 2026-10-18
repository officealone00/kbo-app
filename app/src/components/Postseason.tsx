/**
 * 2026 가을야구 대진표 + 시리즈 상세 (2026-10-18)
 *
 * - 대진표·경기 결과·정규시즌 상대 전적은 누구나 무료로 봐요.
 * - "시리즈 분석"은 [광고 보고 시리즈 분석 보기] → "짧은 광고를 볼까요?" 시트 → [광고 보기]를 눌러야만 광고가 나와요.
 *   끝까지 보면 그 시리즈 분석이 오늘 하루 열려요. 광고를 불러올 수 없으면 그냥 열어 줘요.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  api,
  type BattersData,
  type H2HData,
  type PitchersData,
  type PostGame,
  type PostSeries,
  type PostseasonData,
  type TeamStanding,
} from '@/utils/api';
import { getTeam } from '@/data/teams';
import { BottomSheet, ConfirmSheet } from '@/components/BottomSheet';
import RewardedAd, { preloadReportAd } from '@/components/RewardedAd';
import { analyzeTeamForm, findTopPlayers } from '@/utils/teamAnalytics';
import { logEvent } from '@/utils/tossGrowth';

const ROUND_ORDER: PostSeries['id'][] = ['wc', 'semi', 'po', 'ks'];
const ROUND_NAME: Record<PostSeries['id'], string> = {
  wc: '와일드카드 결정전',
  semi: '준플레이오프',
  po: '플레이오프',
  ks: '한국시리즈',
};
const ROUND_RULE: Record<PostSeries['id'], string> = {
  wc: '4위 1승 안고 시작 · 최대 2경기',
  semi: '5전 3선승',
  po: '5전 3선승',
  ks: '7전 4선승',
};
/** 기록 페이지 시리즈 번호 → 시리즈 id */
export const SERIES_BY_SR: Record<string, PostSeries['id']> = { '4': 'wc', '3': 'semi', '5': 'po', '7': 'ks' };

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
export function fmtDate(d: string) {
  const dt = new Date(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8));
  return `${+d.slice(4, 6)}.${+d.slice(6, 8)} (${DOW[dt.getDay()]})`;
}

function kstToday() {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  return now.toISOString().slice(0, 10).replace(/-/g, '');
}

const unlockKey = (id: string) => `kbo-series-unlock-${id}-${kstToday()}`;
function isUnlocked(id: string) {
  try {
    return localStorage.getItem(unlockKey(id)) === '1';
  } catch {
    return false;
  }
}
function setUnlocked(id: string) {
  try {
    localStorage.setItem(unlockKey(id), '1');
  } catch {}
}

/** 대진표 한 칸: 실제 시리즈 또는 아직 정해지지 않은 다음 라운드 */
interface Slot {
  id: PostSeries['id'];
  series: PostSeries | null;
  /** 아직 시작 전인 라운드의 예상 대진 */
  waiting?: { top: string; bottom: string };
}

function buildBracket(post: PostseasonData | null, standings: TeamStanding[]): Slot[] {
  const byId = Object.fromEntries((post?.series ?? []).map((s) => [s.id, s]));
  const rankTeam = (r: number) => standings.find((t) => t.rank === r)?.team ?? `${r}위`;
  const SHORT: Record<PostSeries['id'], string> = { wc: 'WC', semi: '준PO', po: 'PO', ks: 'KS' };
  const winnerOf = (id: PostSeries['id']) => byId[id]?.winner ?? `${SHORT[id]} 승자`;
  return ROUND_ORDER.map((id) => {
    if (byId[id]) return { id, series: byId[id] };
    if (id === 'wc') return { id, series: null, waiting: { top: rankTeam(4), bottom: rankTeam(5) } };
    if (id === 'semi') return { id, series: null, waiting: { top: rankTeam(3), bottom: winnerOf('wc') } };
    if (id === 'po') return { id, series: null, waiting: { top: rankTeam(2), bottom: winnerOf('semi') } };
    return { id, series: null, waiting: { top: rankTeam(1), bottom: winnerOf('po') } };
  });
}

function seriesHeadline(s: PostSeries): string {
  const [a, b] = s.teams;
  const wa = s.wins[a] ?? 0;
  const wb = s.wins[b] ?? 0;
  if (s.winner) {
    const loser = s.winner === a ? b : a;
    return `${s.winner} 진출 (${s.wins[s.winner] ?? 0}승 ${s.wins[loser] ?? 0}패)`;
  }
  if (wa === 0 && wb === 0) return '곧 시작해요';
  if (wa === wb) return `${wa}승 ${wb}승 동률`;
  const lead = wa > wb ? a : b;
  const need = (s.winsNeeded ?? 1) - Math.max(wa, wb);
  return `${lead} ${Math.max(wa, wb)}승 ${Math.min(wa, wb)}패 · ${need}승 남음`;
}

function nextGame(s: PostSeries): PostGame | undefined {
  return s.games.find((g) => g.status === '예정');
}

/** 순위 화면 위에 띄우는 한 줄 소식 */
export function PostseasonStrip({ onOpen }: { onOpen: () => void }) {
  const [post, setPost] = useState<PostseasonData | null>(null);
  useEffect(() => {
    void api.postseason().then(setPost);
  }, []);
  const live = useMemo(() => {
    const list = post?.series ?? [];
    return [...list].reverse().find((s) => !s.winner) ?? list[list.length - 1];
  }, [post]);
  if (!live) return null;
  const ng = nextGame(live);
  return (
    <button
      type="button"
      onClick={() => {
        logEvent('postseason_strip_click', { series: live.id });
        onOpen();
      }}
      className="w-full text-left rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-toss"
      style={{ background: 'linear-gradient(135deg, #FF8A3D 0%, #F04452 100%)' }}
    >
      <span className="text-2xl">🍂</span>
      <div className="flex-1 min-w-0 text-white">
        <p className="text-[12px] font-semibold opacity-90">2026 가을야구 · {live.name}</p>
        <p className="text-[15px] font-bold truncate">{seriesHeadline(live)}</p>
        {ng && <p className="text-[12px] opacity-90">다음 경기 {fmtDate(ng.gameDate)} {ng.time ?? ''}</p>}
      </div>
      <span className="text-white text-lg">›</span>
    </button>
  );
}

/** 경기 화면 맨 위 대진표 카드 */
export function PostseasonBracket() {
  const [post, setPost] = useState<PostseasonData | null>(null);
  const [standings, setStandings] = useState<TeamStanding[]>([]);
  const [openId, setOpenId] = useState<PostSeries['id'] | null>(null);

  useEffect(() => {
    void Promise.all([api.postseason(), api.standings()]).then(([p, s]) => {
      setPost(p);
      setStandings(s);
    });
  }, []);

  const slots = useMemo(() => buildBracket(post, standings), [post, standings]);
  if (!post || post.series.length === 0) return null;
  const rankOf = (t: string) => standings.find((s) => s.team === t)?.rank;
  const opened = post.series.find((s) => s.id === openId) ?? null;
  const liveId = [...post.series].reverse().find((s) => !s.winner)?.id;

  return (
    <div className="bg-white rounded-toss p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <p className="font-bold text-toss-gray-900">🍂 2026 가을야구 대진표</p>
        <p className="text-[11px] text-toss-gray-500">눌러서 자세히 보기</p>
      </div>
      <div className="space-y-2">
        {slots.map((slot) => {
          const s = slot.series;
          const teams = s ? s.teams : [slot.waiting!.top, slot.waiting!.bottom];
          const isLive = s && s.id === liveId;
          return (
            <button
              key={slot.id}
              type="button"
              disabled={!s}
              onClick={() => {
                if (!s) return;
                logEvent('series_open', { series: s.id });
                setOpenId(s.id);
              }}
              className="w-full text-left rounded-xl px-3 py-3 border transition-all disabled:opacity-60"
              style={{
                borderColor: isLive ? '#3182F6' : '#E5E8EB',
                backgroundColor: isLive ? '#F2F7FF' : 'white',
              }}
            >
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-bold" style={{ color: isLive ? '#3182F6' : '#6B7684' }}>
                  {ROUND_NAME[slot.id]}
                  {isLive && ' · 진행 중'}
                </p>
                <p className="text-[11px] text-toss-gray-500">{ROUND_RULE[slot.id]}</p>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                {teams.map((t, i) => {
                  const info = getTeam(t);
                  const win = s?.wins[t];
                  const lost = s?.winner && s.winner !== t;
                  const r = rankOf(t);
                  return (
                    <div key={t + i} className="flex-1 flex items-center gap-1.5 min-w-0" style={{ opacity: lost ? 0.45 : 1 }}>
                      {i === 1 && <span className="text-toss-gray-300 text-xs mr-1">vs</span>}
                      <span className="text-lg">{info.emoji}</span>
                      <span className="font-bold text-[14px] text-toss-gray-900 truncate">{t}</span>
                      {r && <span className="text-[10px] text-toss-gray-500">{r}위</span>}
                      {win != null && <span className="ml-auto font-extrabold text-[16px] tabular-nums" style={{ color: info.color }}>{win}</span>}
                    </div>
                  );
                })}
              </div>
              {s && <p className="mt-1 text-[12px] text-toss-gray-600">{seriesHeadline(s)}</p>}
              {!s && <p className="mt-1 text-[12px] text-toss-gray-500">대진이 정해지면 알려 드려요</p>}
            </button>
          );
        })}
      </div>
      <SeriesSheet series={opened} standings={standings} onClose={() => setOpenId(null)} />
    </div>
  );
}

/** 시리즈 상세 시트 */
function SeriesSheet({ series, standings, onClose }: { series: PostSeries | null; standings: TeamStanding[]; onClose: () => void }) {
  const [h2h, setH2h] = useState<H2HData | null>(null);
  const [batters, setBatters] = useState<BattersData | null>(null);
  const [pitchers, setPitchers] = useState<PitchersData | null>(null);
  const [postB, setPostB] = useState<(BattersData & { series?: string }) | null>(null);
  const [unlocked, setUnlockedState] = useState(false);
  const [ask, setAsk] = useState(false);
  const [adShown, setAdShown] = useState(false);

  useEffect(() => {
    if (!series) return;
    setUnlockedState(isUnlocked(series.id));
    if (!isUnlocked(series.id)) preloadReportAd();
    void Promise.all([api.h2h(), api.batters(), api.pitchers(), api.postBatters()]).then(([h, b, p, pb]) => {
      setH2h(h);
      setBatters(b);
      setPitchers(p);
      setPostB(pb);
    });
  }, [series]);

  if (!series) return null;
  const [a, b] = series.teams;
  const ia = getTeam(a);
  const ib = getTeam(b);
  const rec = h2h?.h2h?.[a]?.[b];
  const sa = standings.find((t) => t.team === a);
  const sb = standings.find((t) => t.team === b);

  return (
    <>
      <BottomSheet open={!!series} onClose={onClose} title={`${series.name}`}>
        {/* 스코어 */}
        <div className="rounded-2xl bg-toss-gray-50 p-4 flex items-center justify-around">
          {[a, b].map((t) => {
            const info = getTeam(t);
            return (
              <div key={t} className="text-center" style={{ opacity: series.winner && series.winner !== t ? 0.45 : 1 }}>
                <p className="text-3xl">{info.emoji}</p>
                <p className="font-bold text-toss-gray-900 mt-1">{t}</p>
                <p className="text-3xl font-extrabold tabular-nums mt-1" style={{ color: info.color }}>
                  {series.wins[t] ?? 0}
                </p>
              </div>
            );
          })}
        </div>
        <p className="text-center text-[14px] font-semibold text-toss-gray-700 mt-2">{seriesHeadline(series)}</p>
        <p className="text-center text-[12px] text-toss-gray-500">{ROUND_RULE[series.id]}</p>

        {/* 경기 목록 */}
        <p className="mt-5 mb-2 font-bold text-toss-gray-900">경기 일정 · 결과</p>
        <div className="divide-y divide-toss-gray-100 rounded-2xl border border-toss-gray-100">
          {series.games.map((g, i) => {
            const done = g.status === '종료' && g.homeScore != null && g.awayScore != null;
            const w = done ? ((g.homeScore ?? 0) > (g.awayScore ?? 0) ? g.home : g.away) : null;
            return (
              <div key={i} className="flex items-center px-3 py-3 text-[14px]">
                <span className="w-12 text-[12px] font-bold text-toss-gray-500">{i + 1}차전</span>
                <span className="w-24 text-[12px] text-toss-gray-500">{fmtDate(g.gameDate)}</span>
                <span className="flex-1 font-semibold text-toss-gray-900">
                  {g.away} {done ? `${g.awayScore} : ${g.homeScore}` : 'vs'} {g.home}
                </span>
                <span className="text-[12px] font-bold" style={{ color: w ? getTeam(w).color : '#8B95A1' }}>
                  {w ? `${w} 승` : g.status === '예정' ? g.time ?? '예정' : g.status}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] text-toss-gray-400">팀 이름 순서: 원정 · 홈. 남은 경기는 앞 시리즈 결과에 따라 열리지 않을 수 있어요.</p>

        {/* 정규시즌 상대 전적 (무료) */}
        {rec && (
          <div className="mt-5 rounded-2xl bg-toss-gray-50 p-4">
            <p className="font-bold text-toss-gray-900 mb-2">정규시즌 맞대결</p>
            <div className="flex items-center justify-between text-[15px]">
              <span className="font-bold" style={{ color: ia.color }}>{a} {rec.w}승</span>
              <span className="text-toss-gray-400 text-[13px]">{rec.d > 0 ? `${rec.d}무` : 'vs'}</span>
              <span className="font-bold" style={{ color: ib.color }}>{rec.l}승 {b}</span>
            </div>
            <div className="mt-2 h-2 rounded-full overflow-hidden flex bg-toss-gray-200">
              <div style={{ width: `${(rec.w / Math.max(1, rec.w + rec.l)) * 100}%`, backgroundColor: ia.color }} />
              <div style={{ flex: 1, backgroundColor: ib.color }} />
            </div>
          </div>
        )}

        {/* 시리즈 분석 */}
        <p className="mt-5 mb-2 font-bold text-toss-gray-900">🔍 시리즈 분석</p>
        {unlocked && sa && sb ? (
          <SeriesAnalysis series={series} sa={sa} sb={sb} batters={batters} pitchers={pitchers} postB={postB} />
        ) : (
          <div className="relative rounded-2xl border border-toss-gray-100 p-4">
            <div className="space-y-2 blur-sm select-none pointer-events-none" aria-hidden>
              <div className="h-4 w-2/3 rounded bg-toss-gray-200" />
              <div className="h-4 w-1/2 rounded bg-toss-gray-200" />
              <div className="h-16 rounded-xl bg-toss-gray-100" />
              <div className="h-4 w-3/4 rounded bg-toss-gray-200" />
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
              <p className="text-[14px] font-semibold text-toss-gray-800">승리 조건 · 시즌 비교 · 핵심 선수</p>
              <button
                type="button"
                onClick={() => setAsk(true)}
                className="mt-3 w-full max-w-[260px] rounded-xl bg-toss-blue py-3 text-[15px] font-bold text-white"
              >
                광고 보고 시리즈 분석 보기
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      <ConfirmSheet
        open={ask}
        desc={'짧은 광고를 끝까지 보면\n오늘 하루 이 시리즈 분석을 볼 수 있어요.'}
        onClose={() => setAsk(false)}
        onConfirm={() => {
          setAsk(false);
          setAdShown(true);
        }}
      />
      {adShown && (
        <RewardedAd
          onReward={() => {
            setUnlocked(series.id);
            setUnlockedState(true);
            logEvent('series_analysis_unlocked', { series: series.id });
          }}
          onClose={() => setAdShown(false)}
        />
      )}
    </>
  );
}

function SeriesAnalysis({
  series,
  sa,
  sb,
  batters,
  pitchers,
  postB,
}: {
  series: PostSeries;
  sa: TeamStanding;
  sb: TeamStanding;
  batters: BattersData | null;
  pitchers: PitchersData | null;
  postB: (BattersData & { series?: string }) | null;
}) {
  const [a, b] = series.teams;
  const fa = analyzeTeamForm(sa);
  const fb = analyzeTeamForm(sb);
  const need = series.winsNeeded;
  const played = series.games.filter((g) => g.status === '종료').length;
  const ng = nextGame(series);
  const nextHome = ng?.home;

  const condition = (t: string) => {
    if (series.winner) return series.winner === t ? '다음 라운드 진출 확정' : '탈락';
    if (!need) return '이기면 다음 라운드';
    const left = need - (series.wins[t] ?? 0);
    return left === 1 ? '1승만 더하면 진출' : `${left}승이 더 필요해요`;
  };

  const rows: Array<[string, string, string]> = [
    ['정규시즌 순위', `${sa.rank}위`, `${sb.rank}위`],
    ['승률', sa.winRate.toFixed(3), sb.winRate.toFixed(3)],
    ['홈 승률', fa.homeWinRate.toFixed(3), fb.homeWinRate.toFixed(3)],
    ['원정 승률', fa.awayWinRate.toFixed(3), fb.awayWinRate.toFixed(3)],
    ['최근 10경기', sa.last10, sb.last10],
  ];

  const hot = (t: string) =>
    SERIES_BY_SR[postB?.series ?? ''] === series.id ? (postB?.avg ?? []).filter((p) => p.team === t).slice(0, 2) : [];
  const ta = findTopPlayers(a, batters, pitchers);
  const tb = findTopPlayers(b, batters, pitchers);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-toss-gray-50 p-4">
        <p className="text-[13px] font-bold text-toss-gray-600 mb-2">남은 승리 조건 ({played}경기 마침)</p>
        {[a, b].map((t) => (
          <p key={t} className="text-[15px] text-toss-gray-900">
            <span className="font-bold" style={{ color: getTeam(t).color }}>{t}</span> · {condition(t)}
          </p>
        ))}
        {series.id === 'wc' && <p className="mt-1 text-[12px] text-toss-gray-500">4위 팀은 1승을 안고 시작해요.</p>}
      </div>

      <div className="rounded-2xl border border-toss-gray-100 overflow-hidden">
        <div className="grid grid-cols-3 bg-toss-gray-50 px-3 py-2 text-[12px] font-bold text-toss-gray-600">
          <span>정규시즌</span>
          <span className="text-center" style={{ color: getTeam(a).color }}>{a}</span>
          <span className="text-center" style={{ color: getTeam(b).color }}>{b}</span>
        </div>
        {rows.map(([k, va, vb]) => (
          <div key={k} className="grid grid-cols-3 px-3 py-2.5 text-[14px] border-t border-toss-gray-100">
            <span className="text-toss-gray-600">{k}</span>
            <span className="text-center font-semibold text-toss-gray-900">{va}</span>
            <span className="text-center font-semibold text-toss-gray-900">{vb}</span>
          </div>
        ))}
      </div>

      {ng && nextHome && (
        <div className="rounded-2xl bg-toss-gray-50 p-4 text-[14px] leading-relaxed text-toss-gray-800">
          <p className="text-[13px] font-bold text-toss-gray-600 mb-1">다음 경기 {fmtDate(ng.gameDate)} · {nextHome} 홈</p>
          {nextHome} 홈 승률 {(nextHome === a ? fa.homeWinRate : fb.homeWinRate).toFixed(3)}, {nextHome === a ? b : a} 원정 승률{' '}
          {(nextHome === a ? fb.awayWinRate : fa.awayWinRate).toFixed(3)} (정규시즌 기준)
        </div>
      )}

      {[a, b].some((t) => hot(t).length > 0) && (
        <div className="rounded-2xl border border-toss-gray-100 p-4">
          <p className="text-[13px] font-bold text-toss-gray-600 mb-2">🔥 이번 시리즈 타율 상위</p>
          {[a, b].flatMap((t) =>
            hot(t).map((p) => (
              <p key={t + p.name} className="text-[14px] text-toss-gray-900">
                <span className="font-bold" style={{ color: getTeam(t).color }}>{t}</span> {p.name} · 타율 {p.avg.toFixed(3)} ({p.games}경기)
              </p>
            )),
          )}
        </div>
      )}

      <div className="rounded-2xl border border-toss-gray-100 p-4">
        <p className="text-[13px] font-bold text-toss-gray-600 mb-2">⭐ 정규시즌 핵심 선수</p>
        {([
          [a, ta],
          [b, tb],
        ] as const).map(([t, tp]) => (
          <div key={t} className="mb-2 last:mb-0">
            <p className="font-bold text-[14px]" style={{ color: getTeam(t).color }}>{t}</p>
            <p className="text-[13px] text-toss-gray-700">
              {[tp.topBatter, tp.topHR, tp.topPitcher, tp.topSO]
                .filter(Boolean)
                .map((x) => `${x!.name} ${x!.stat} ${x!.value}`)
                .join(' · ') || '상위 30위 안 기록이 없어요'}
            </p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-toss-gray-400">KBO 공식 기록을 바탕으로 계산했어요. 결과를 예측하지는 않아요.</p>
    </div>
  );
}
