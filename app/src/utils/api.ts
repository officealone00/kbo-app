/**
 * 데이터 API
 *
 * GitHub repo의 data/*.json을 jsdelivr CDN으로 불러옵니다.
 * - 재시도: 최대 3회 (지수 백오프: 500ms → 1s → 2s)
 * - 타임아웃: 8초
 * - 폴백 CDN: jsdelivr 장애 시 raw.githubusercontent 시도
 * - 최종 폴백: 내장 기본 데이터 (빈 화면 방지)
 */

import {
  FALLBACK_STANDINGS,
  FALLBACK_BATTERS,
  FALLBACK_PITCHERS,
  FALLBACK_GAMES,
  FALLBACK_META,
} from './fallback';

const CONFIG = {
  githubUser: 'officealone00',
  repo: 'kbo-app',
  branch: 'main',
};

function cdnUrl(path: string): string {
  const { githubUser, repo, branch } = CONFIG;
  // jsdelivr 형식: https://cdn.jsdelivr.net/gh/{user}/{repo}@{branch}/{path}
  return `https://cdn.jsdelivr.net/gh/${githubUser}/${repo}@${branch}/${path}`;
}

// 대체 CDN (jsdelivr 장애 시 사용)
function cdnUrlBackup(path: string): string {
  const { githubUser, repo, branch } = CONFIG;
  return `https://raw.githubusercontent.com/${githubUser}/${repo}/${branch}/${path}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonWithRetry<T>(path: string, fallback: T): Promise<T> {
  // 캐시 버스터: 10분 단위로 바뀌도록 (CDN은 보통 10분 캐시)
  const buster = Math.floor(Date.now() / (10 * 60 * 1000));
  const primary = `${cdnUrl(path)}?v=${buster}`;
  const backup = `${cdnUrlBackup(path)}?v=${buster}`;

  // 1~3차: jsdelivr (지수 백오프)
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetchWithTimeout(primary);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn(`[api] jsdelivr 시도 ${i + 1} 실패: ${path}`, e);
    }
    if (i < 2) await sleep(500 * Math.pow(2, i)); // 500ms, 1s
  }

  // 4차: raw.githubusercontent 폴백 CDN
  try {
    const res = await fetchWithTimeout(backup);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn(`[api] raw 폴백 실패: ${path}`, e);
  }

  // 최종 폴백: 내장 기본 데이터 (빈 화면 방지)
  console.warn(`[api] 모든 요청 실패, 폴백 데이터 사용: ${path}`);
  return fallback;
}

// ─── 타입 정의 ──────────────────────────────
export interface TeamStanding {
  rank: number;
  team: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  gamesBehind: number;
  last10: string;
  streak: string;
  home: string;
  away: string;
}

export interface Batter {
  rank: number;
  name: string;
  team: string;
  avg: number;
  games: number;
  pa?: number;
  ab?: number;
  r?: number;
  h?: number;
  doubles?: number;
  triples?: number;
  hr: number;
  tb?: number;
  rbi: number;
  sb?: number;
}

export interface Pitcher {
  rank: number;
  name: string;
  team: string;
  era: number;
  g: number;
  w: number;
  l?: number;
  sv: number;
  hld?: number;
  winRate?: number;
  ip?: number;
  h?: number;
  hr?: number;
  bb?: number;
  so: number;
  role: '선발' | '불펜' | '마무리';
}

export interface BattersData {
  avg: Batter[];
  hr: Batter[];
  rbi: Batter[];
  sb: Batter[];
}

export interface PitchersData {
  era: Pitcher[];
  w: Pitcher[];
  so: Pitcher[];
  sv: Pitcher[];
}

export interface Game {
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  time?: string;
  stadium?: string;
}

export interface GamesData {
  today: { date: string; games: Game[] };
  yesterday: { date: string; games: Game[] };
}

export interface Meta {
  updatedAt: string;
  updatedAtKST: string;
  season: number;
  success: number;
  total: number;
}

// ─── API 함수들 (모두 자동 폴백 내장) ──────────────────────────────
export const api = {
  standings: () =>
    fetchJsonWithRetry<TeamStanding[]>('data/standings.json', FALLBACK_STANDINGS),
  batters: () =>
    fetchJsonWithRetry<BattersData>('data/batters.json', FALLBACK_BATTERS),
  pitchers: () =>
    fetchJsonWithRetry<PitchersData>('data/pitchers.json', FALLBACK_PITCHERS),
  games: () =>
    fetchJsonWithRetry<GamesData>('data/games.json', FALLBACK_GAMES),
  meta: () =>
    fetchJsonWithRetry<Meta>('data/meta.json', FALLBACK_META),
};