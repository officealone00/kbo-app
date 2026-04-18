/**
 * 데이터 API
 *
 * GitHub repo의 data/*.json을 jsdelivr CDN으로 불러옵니다.
 * jsdelivr는 CORS 허용 + 빠른 CDN 캐시 제공.
 *
 * 배포 시 CONFIG의 githubUser/repo/branch를 본인 값으로 변경하세요.
 */

// TODO: GitHub 배포 시 본인 정보로 교체
const CONFIG = {
  githubUser: 'YOUR_GITHUB_USERNAME',
  repo: 'kbo-ranking-app',
  branch: 'main',
};

function cdnUrl(path: string): string {
  const { githubUser, repo, branch } = CONFIG;
  // jsdelivr 형식: https://cdn.jsdelivr.net/gh/{user}/{repo}@{branch}/{path}
  return `https://cdn.jsdelivr.net/gh/${githubUser}/${repo}@${branch}/${path}`;
}

async function fetchJson<T>(path: string): Promise<T> {
  // 캐시 버스터: 10분 단위로 바뀌도록 (CDN은 보통 10분 캐시)
  const buster = Math.floor(Date.now() / (10 * 60 * 1000));
  const url = `${cdnUrl(path)}?v=${buster}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`데이터 로딩 실패 (${res.status}): ${path}`);
  }
  return res.json();
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

// ─── API 함수들 ──────────────────────────────
export const api = {
  standings: () => fetchJson<TeamStanding[]>('data/standings.json'),
  batters: () => fetchJson<BattersData>('data/batters.json'),
  pitchers: () => fetchJson<PitchersData>('data/pitchers.json'),
  games: () => fetchJson<GamesData>('data/games.json'),
  meta: () => fetchJson<Meta>('data/meta.json'),
};

// ─── 로컬 개발용 폴백 ─────────────────────────
// 로컬 개발 시 CDN 연결이 안 되면 로컬 JSON 사용
// (vite dev 서버에서 /data/ 접근이 가능하도록 public 폴더 활용 가능)
