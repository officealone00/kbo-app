/**
 * 네트워크 실패 시 폴백 데이터
 *
 * CDN 장애, 인터넷 끊김, 앱 첫 설치 후 네트워크 차단 등
 * 실패 케이스에도 "빈 화면"이 뜨지 않도록 최소 데이터 제공.
 *
 * 실제 최신 데이터는 네트워크 복구 시 자동으로 덮어씌워짐.
 */

import type { TeamStanding, BattersData, PitchersData, GamesData, Meta } from './api';

export const FALLBACK_STANDINGS: TeamStanding[] = [
  { rank: 1, team: '삼성', games: 0, wins: 0, losses: 0, draws: 0, winRate: 0, gamesBehind: 0, last10: '-', streak: '-', home: '-', away: '-' },
  { rank: 2, team: 'LG', games: 0, wins: 0, losses: 0, draws: 0, winRate: 0, gamesBehind: 0, last10: '-', streak: '-', home: '-', away: '-' },
  { rank: 3, team: 'KT', games: 0, wins: 0, losses: 0, draws: 0, winRate: 0, gamesBehind: 0, last10: '-', streak: '-', home: '-', away: '-' },
  { rank: 4, team: 'SSG', games: 0, wins: 0, losses: 0, draws: 0, winRate: 0, gamesBehind: 0, last10: '-', streak: '-', home: '-', away: '-' },
  { rank: 5, team: 'KIA', games: 0, wins: 0, losses: 0, draws: 0, winRate: 0, gamesBehind: 0, last10: '-', streak: '-', home: '-', away: '-' },
  { rank: 6, team: 'NC', games: 0, wins: 0, losses: 0, draws: 0, winRate: 0, gamesBehind: 0, last10: '-', streak: '-', home: '-', away: '-' },
  { rank: 7, team: '한화', games: 0, wins: 0, losses: 0, draws: 0, winRate: 0, gamesBehind: 0, last10: '-', streak: '-', home: '-', away: '-' },
  { rank: 8, team: '롯데', games: 0, wins: 0, losses: 0, draws: 0, winRate: 0, gamesBehind: 0, last10: '-', streak: '-', home: '-', away: '-' },
  { rank: 9, team: '두산', games: 0, wins: 0, losses: 0, draws: 0, winRate: 0, gamesBehind: 0, last10: '-', streak: '-', home: '-', away: '-' },
  { rank: 10, team: '키움', games: 0, wins: 0, losses: 0, draws: 0, winRate: 0, gamesBehind: 0, last10: '-', streak: '-', home: '-', away: '-' },
];

export const FALLBACK_BATTERS: BattersData = {
  avg: [],
  hr: [],
  rbi: [],
  sb: [],
};

export const FALLBACK_PITCHERS: PitchersData = {
  era: [],
  w: [],
  so: [],
  sv: [],
};

export const FALLBACK_GAMES: GamesData = {
  today: { date: '', games: [] },
  yesterday: { date: '', games: [] },
};

export const FALLBACK_META: Meta = {
  updatedAt: new Date().toISOString(),
  updatedAtKST: new Date().toLocaleString('ko-KR'),
  season: new Date().getFullYear(),
  success: 0,
  total: 4,
};