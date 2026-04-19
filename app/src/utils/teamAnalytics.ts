/**
 * 팀 상세 분석 로직
 *
 * 순위표/타자/투수/경기 데이터를 종합해서
 * 응원팀의 상세 분석 리포트를 생성합니다.
 */

import type { TeamStanding, BattersData, PitchersData, GamesData, Batter, Pitcher, Game } from './api';

// ─── 팀 폼 분석 ───────────────────────────
export interface TeamForm {
  trend: 'up' | 'down' | 'steady';
  trendLabel: string;
  momentum: number; // 0~100
  momentumLabel: string;
  homeWinRate: number;
  awayWinRate: number;
  last10Record: string;
  streakType: 'win' | 'lose';
  streakCount: number;
}

export function analyzeTeamForm(standing: TeamStanding): TeamForm {
  // 최근 10경기 분석
  const last10 = standing.last10 || '0승0무0패';
  const match = last10.match(/(\d+)승(\d+)무(\d+)패/);
  const recentWins = match ? parseInt(match[1]) : 0;
  const recentLosses = match ? parseInt(match[3]) : 0;
  const recentTotal = recentWins + recentLosses || 1;
  const recentRate = recentWins / recentTotal;

  // 홈/원정 분리 (형식: "승-무-패")
  const parseRecord = (rec: string) => {
    const parts = (rec || '0-0-0').split('-').map(Number);
    const w = parts[0] || 0;
    const l = parts[2] || 0;
    const total = w + l || 1;
    return { w, l, rate: w / total };
  };
  const home = parseRecord(standing.home);
  const away = parseRecord(standing.away);

  // 연속 기록
  const streakMatch = standing.streak?.match(/(\d+)(승|패)/);
  const streakCount = streakMatch ? parseInt(streakMatch[1]) : 0;
  const streakType: 'win' | 'lose' = streakMatch?.[2] === '승' ? 'win' : 'lose';

  // 트렌드 판정
  let trend: 'up' | 'down' | 'steady';
  let trendLabel: string;
  if (recentRate >= 0.6) {
    trend = 'up';
    trendLabel = '🔥 상승세';
  } else if (recentRate <= 0.4) {
    trend = 'down';
    trendLabel = '❄️ 부진';
  } else {
    trend = 'steady';
    trendLabel = '⚖️ 평균';
  }

  // 모멘텀 (0~100)
  const baseMomentum = recentRate * 100;
  const streakBonus = streakType === 'win' ? streakCount * 3 : -streakCount * 3;
  const momentum = Math.max(0, Math.min(100, baseMomentum + streakBonus));

  let momentumLabel: string;
  if (momentum >= 70) momentumLabel = '매우 좋음';
  else if (momentum >= 50) momentumLabel = '좋음';
  else if (momentum >= 30) momentumLabel = '보통';
  else momentumLabel = '저조';

  return {
    trend,
    trendLabel,
    momentum: Math.round(momentum),
    momentumLabel,
    homeWinRate: home.rate,
    awayWinRate: away.rate,
    last10Record: last10,
    streakType,
    streakCount,
  };
}

// ─── 순위 전망 ───────────────────────────
export interface RankOutlook {
  currentRank: number;
  gapToPostseason: number;    // 포스트시즌(5위)까지 게임차
  gapToTop4: number;           // 4위까지 게임차
  gapToTop1: number;           // 1위까지 게임차
  projection: string;          // 예상 최종 순위
  postseasonProbability: 'high' | 'medium' | 'low';
}

export function analyzeRankOutlook(
  myStanding: TeamStanding,
  allStandings: TeamStanding[]
): RankOutlook {
  const top1 = allStandings[0];
  const top4 = allStandings.find((s) => s.rank === 4);
  const top5 = allStandings.find((s) => s.rank === 5);

  const gapToTop1 = myStanding.gamesBehind;
  const gapToTop4 = top4 ? Math.max(0, myStanding.gamesBehind - top4.gamesBehind) : 0;
  const gapToPostseason = top5 ? Math.max(0, myStanding.gamesBehind - top5.gamesBehind) : 0;

  // 포스트시즌 진출 확률 (1~5위)
  let postseasonProbability: 'high' | 'medium' | 'low';
  if (myStanding.rank <= 4) postseasonProbability = 'high';
  else if (myStanding.rank === 5) postseasonProbability = 'medium';
  else if (myStanding.rank <= 7 && gapToPostseason < 5) postseasonProbability = 'medium';
  else postseasonProbability = 'low';

  // 최종 순위 예측 (현재 페이스 기준)
  let projection: string;
  if (myStanding.rank <= 3) projection = `${myStanding.rank}~${myStanding.rank + 1}위 유지 가능`;
  else if (myStanding.rank <= 5) projection = `${myStanding.rank - 1}~${myStanding.rank + 1}위 예상`;
  else projection = `${myStanding.rank - 1}~${Math.min(10, myStanding.rank + 1)}위 예상`;

  return {
    currentRank: myStanding.rank,
    gapToPostseason,
    gapToTop4,
    gapToTop1,
    projection,
    postseasonProbability,
  };
}

// ─── 팀 내 TOP 선수 ───────────────────────
export interface TopPlayers {
  topBatter: { name: string; stat: string; value: string } | null;
  topHR: { name: string; stat: string; value: string } | null;
  topPitcher: { name: string; stat: string; value: string } | null;
  topSO: { name: string; stat: string; value: string } | null;
}

export function findTopPlayers(
  teamName: string,
  batters: BattersData | null,
  pitchers: PitchersData | null
): TopPlayers {
  const findBest = <T extends Batter | Pitcher>(
    list: T[] | undefined,
    team: string
  ): T | null => {
    if (!list) return null;
    const filtered = list.filter((p) => p.team === team);
    return filtered[0] || null;
  };

  const topAvg = findBest(batters?.avg, teamName);
  const topHR = findBest(batters?.hr, teamName);
  const topERA = findBest(pitchers?.era, teamName);
  const topSO = findBest(pitchers?.so, teamName);

  return {
    topBatter: topAvg
      ? { name: topAvg.name, stat: '타율', value: topAvg.avg.toFixed(3) }
      : null,
    topHR: topHR
      ? { name: topHR.name, stat: '홈런', value: `${topHR.hr}개` }
      : null,
    topPitcher: topERA
      ? { name: topERA.name, stat: 'ERA', value: topERA.era.toFixed(2) }
      : null,
    topSO: topSO
      ? { name: topSO.name, stat: '삼진', value: `${topSO.so}K` }
      : null,
  };
}

// ─── 최근 경기 기록 ───────────────────────
export interface RecentGame {
  date: string;
  opponent: string;
  isHome: boolean;
  teamScore: number | null;
  opponentScore: number | null;
  result: 'win' | 'lose' | 'pending';
}

export function findRecentGames(teamName: string, games: GamesData | null): RecentGame[] {
  if (!games) return [];
  const all: Array<{ game: Game; dateLabel: string }> = [
    ...(games.yesterday?.games || []).map((g) => ({ game: g, dateLabel: '어제' })),
    ...(games.today?.games || []).map((g) => ({ game: g, dateLabel: '오늘' })),
  ];

  return all
    .filter((g) => g.game.home === teamName || g.game.away === teamName)
    .map(({ game, dateLabel }) => {
      const isHome = game.home === teamName;
      const teamScore = isHome ? game.homeScore : game.awayScore;
      const opponentScore = isHome ? game.awayScore : game.homeScore;
      const opponent = isHome ? game.away : game.home;

      let result: 'win' | 'lose' | 'pending' = 'pending';
      if (teamScore != null && opponentScore != null) {
        result = teamScore > opponentScore ? 'win' : 'lose';
      }

      return {
        date: dateLabel,
        opponent,
        isHome,
        teamScore,
        opponentScore,
        result,
      };
    });
}

// ─── 종합 리포트 ───────────────────────────
export interface TeamReport {
  team: string;
  form: TeamForm;
  outlook: RankOutlook;
  topPlayers: TopPlayers;
  recentGames: RecentGame[];
  insight: string;       // 한 줄 요약
}

export function generateTeamReport(
  teamName: string,
  standings: TeamStanding[],
  batters: BattersData | null,
  pitchers: PitchersData | null,
  games: GamesData | null
): TeamReport | null {
  const myStanding = standings.find((s) => s.team === teamName);
  if (!myStanding) return null;

  const form = analyzeTeamForm(myStanding);
  const outlook = analyzeRankOutlook(myStanding, standings);
  const topPlayers = findTopPlayers(teamName, batters, pitchers);
  const recentGames = findRecentGames(teamName, games);

  // 한 줄 인사이트 생성
  let insight = '';
  if (form.trend === 'up' && outlook.postseasonProbability === 'high') {
    insight = `🔥 상승세를 타고 포스트시즌권을 확실히 지키고 있어요.`;
  } else if (form.trend === 'up' && outlook.postseasonProbability === 'medium') {
    insight = `💪 기세를 몰아 포스트시즌 진출을 노려볼 만해요.`;
  } else if (form.trend === 'down' && outlook.postseasonProbability === 'low') {
    insight = `😥 반등이 필요한 시점이에요. 선수들의 분발이 기대됩니다.`;
  } else if (form.trend === 'down') {
    insight = `⚠️ 최근 경기력이 주춤해요. 홈 경기에서 기세를 찾아야 해요.`;
  } else {
    insight = `⚖️ 꾸준한 페이스를 유지하고 있어요. 변수가 필요할 때예요.`;
  }

  return {
    team: teamName,
    form,
    outlook,
    topPlayers,
    recentGames,
    insight,
  };
}