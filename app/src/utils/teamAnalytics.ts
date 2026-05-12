/**
 * 팀 상세 분석 로직 (야구 분석가/스카우트 톤)
 *
 * 순위표/타자/투수/경기 데이터를 종합해
 * 응원팀의 깊이 있는 분석 리포트를 생성합니다.
 *
 * - 팀 폼: 모멘텀, 최근10, 홈/원정 비대칭
 * - 타격 진단: 컨택/장타/기동력/타점생산력 (상위 30 선수 추출 기반)
 * - 마운드 진단: 선발/불펜/마무리 안정도, ERA 분포
 * - 순위 전망: 매직넘버, 트래직넘버 (KBO 144경기 기준)
 * - 종합 인사이트: 강점/약점/다음 과제 3축 + 헤드라인 코멘트
 */

import type { TeamStanding, BattersData, PitchersData, GamesData, Batter, Pitcher, Game } from './api';

// KBO 정규시즌 기준 (1팀당 144경기)
const REGULAR_SEASON_GAMES = 144;

// ─── 팀 폼 분석 ───────────────────────────
export interface TeamForm {
  trend: 'up' | 'down' | 'steady';
  trendLabel: string;
  momentum: number; // 0~100
  momentumLabel: string;
  homeWinRate: number;
  awayWinRate: number;
  homeAwayGap: number;     // 홈-원정 승률 차 (양수: 홈강, 음수: 원정강)
  homeAwayDiagnosis: string;
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
  const homeAwayGap = home.rate - away.rate;

  // 홈/원정 진단 (야구 해설가 톤)
  let homeAwayDiagnosis: string;
  if (Math.abs(homeAwayGap) < 0.05) {
    homeAwayDiagnosis = '홈·원정 편차 거의 없음 — 안정적인 외부 적응력';
  } else if (homeAwayGap >= 0.15) {
    homeAwayDiagnosis = '홈 어드밴티지 뚜렷 — 원정 보강이 가을야구의 변수';
  } else if (homeAwayGap >= 0.05) {
    homeAwayDiagnosis = '홈에서 다소 강세 — 원정 일정 관리 필요';
  } else if (homeAwayGap <= -0.15) {
    homeAwayDiagnosis = '원정에서 더 강한 이례적 흐름 — 홈팬 앞 부담 신호';
  } else {
    homeAwayDiagnosis = '원정에서 다소 강세 — 홈 응집력 회복이 과제';
  }

  // 연속 기록
  const streakMatch = standing.streak?.match(/(\d+)(승|패)/);
  const streakCount = streakMatch ? parseInt(streakMatch[1]) : 0;
  const streakType: 'win' | 'lose' = streakMatch?.[2] === '승' ? 'win' : 'lose';

  // 트렌드 판정 (최근10 + 연속 보정)
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

  // 모멘텀 (0~100): 최근10 승률 + 연속 보정
  const baseMomentum = recentRate * 100;
  const streakBonus = streakType === 'win' ? streakCount * 3 : -streakCount * 3;
  const momentum = Math.max(0, Math.min(100, baseMomentum + streakBonus));

  let momentumLabel: string;
  if (momentum >= 80) momentumLabel = '폭주 중';
  else if (momentum >= 60) momentumLabel = '상승 흐름';
  else if (momentum >= 40) momentumLabel = '안정세';
  else if (momentum >= 20) momentumLabel = '주춤';
  else momentumLabel = '깊은 침체';

  return {
    trend,
    trendLabel,
    momentum: Math.round(momentum),
    momentumLabel,
    homeWinRate: home.rate,
    awayWinRate: away.rate,
    homeAwayGap,
    homeAwayDiagnosis,
    last10Record: last10,
    streakType,
    streakCount,
  };
}

// ─── 순위 전망 (매직/트래직 넘버 포함) ───────────────────────
export interface RankOutlook {
  currentRank: number;
  gapToPostseason: number;    // 5위까지 게임차
  gapToTop4: number;           // 4위까지 게임차
  gapToTop1: number;           // 1위까지 게임차
  gamesRemaining: number;      // 잔여 경기 수
  magicNumber: number | null;  // 포스트시즌 매직넘버 (5위 안 확정에 필요한 승수)
  tragicNumber: number | null; // 트래직넘버 (탈락 가능성 임계)
  projection: string;          // 예상 최종 순위
  postseasonProbability: 'high' | 'medium' | 'low';
  outlookComment: string;      // 야구 해설가 톤 코멘트
}

export function analyzeRankOutlook(
  myStanding: TeamStanding,
  allStandings: TeamStanding[]
): RankOutlook {
  const top4 = allStandings.find((s) => s.rank === 4);
  const top5 = allStandings.find((s) => s.rank === 5);
  const top6 = allStandings.find((s) => s.rank === 6);

  const gapToTop1 = myStanding.gamesBehind;
  const gapToTop4 = top4 ? Math.max(0, myStanding.gamesBehind - top4.gamesBehind) : 0;
  const gapToPostseason = top5 ? Math.max(0, myStanding.gamesBehind - top5.gamesBehind) : 0;

  // 잔여 경기 (KBO 144경기 기준)
  const played = myStanding.games || (myStanding.wins + myStanding.losses + myStanding.draws);
  const gamesRemaining = Math.max(0, REGULAR_SEASON_GAMES - played);

  // 매직넘버 / 트래직넘버
  // - 매직넘버: (내 잔여승 + 추격팀 잔여패) ≥ 추격팀과의 격차 보정값
  //   간단화: (5위 게임차 + 1) - (추격팀 잔여 경기에서 우리가 안 잡혀도 되는 패)
  //   여기서는 보수적으로: 우리 잔여경기 중 몇 승이 필요한지 (단순 모델)
  let magicNumber: number | null = null;
  let tragicNumber: number | null = null;
  const chaser = top6; // 우리가 5위 안이면 6위가 추격자

  if (myStanding.rank <= 5 && chaser && gamesRemaining > 0) {
    // 매직넘버 (간단 모델): 추격팀과의 차이만큼 승차를 벌려야 안전
    const chaserRemaining = Math.max(0, REGULAR_SEASON_GAMES - chaser.games);
    const myMaxWins = myStanding.wins + gamesRemaining;
    const chaserMaxWins = chaser.wins + chaserRemaining;
    // 추격팀이 잔여를 다 이겨도 우리가 더 많은 승수가 되려면 필요한 추가 승수
    const needed = Math.max(0, chaserMaxWins - myStanding.wins + 1);
    magicNumber = Math.min(gamesRemaining, needed);
  }

  if (myStanding.rank > 5 && top5 && gamesRemaining > 0) {
    // 트래직넘버: 5위와의 격차를 따라잡으려면 몇 승이 추가로 필요한지
    const top5Remaining = Math.max(0, REGULAR_SEASON_GAMES - top5.games);
    const top5MinWins = top5.wins; // 5위가 모두 패한다고 가정
    const target = top5MinWins + 1;
    const needed = Math.max(0, target - myStanding.wins);
    if (needed <= gamesRemaining) {
      tragicNumber = needed;
    }
  }

  // 포스트시즌 확률 (1~5위)
  let postseasonProbability: 'high' | 'medium' | 'low';
  if (myStanding.rank <= 3) postseasonProbability = 'high';
  else if (myStanding.rank === 4) postseasonProbability = 'high';
  else if (myStanding.rank === 5 && gamesRemaining > 20) postseasonProbability = 'medium';
  else if (myStanding.rank === 5) postseasonProbability = 'high';
  else if (myStanding.rank <= 7 && gapToPostseason <= 5) postseasonProbability = 'medium';
  else postseasonProbability = 'low';

  // 최종 순위 예측
  let projection: string;
  if (myStanding.rank <= 3) projection = `${myStanding.rank}~${myStanding.rank + 1}위권 유지 유력`;
  else if (myStanding.rank <= 5) projection = `${Math.max(1, myStanding.rank - 1)}~${myStanding.rank + 1}위권 예상`;
  else projection = `${myStanding.rank - 1}~${Math.min(10, myStanding.rank + 1)}위권 예상`;

  // 야구 해설가 톤 코멘트
  let outlookComment: string;
  if (myStanding.rank === 1) {
    outlookComment = `선두 사수 — 정규시즌 1위 확정 시 KS 직행. 5위와의 격차를 더 벌리는 게 시즌 후반 과제`;
  } else if (myStanding.rank <= 3) {
    outlookComment = `상위권 안정 — 자동진출권 사수가 최우선. PO 시드 경쟁이 본격화되는 구간`;
  } else if (myStanding.rank === 4) {
    outlookComment = `와일드카드권의 직상위 — 5위와의 와카전을 피하려면 4위 굳히기가 핵심`;
  } else if (myStanding.rank === 5) {
    outlookComment = `와일드카드 결정전 진출권 — 6위 추격팀과의 직접 맞대결이 분수령`;
  } else if (gapToPostseason <= 3) {
    outlookComment = `포스트시즌권 사정거리 — 잔여 경기 6할 승률이 5위 진입의 마지노선`;
  } else if (gapToPostseason <= 7) {
    outlookComment = `반등이 절실한 시점 — 상위팀과의 직접 맞대결에서 승점 사냥 필요`;
  } else {
    outlookComment = `다음 시즌을 보는 안목이 필요한 구간 — 유망주 등용과 전력 재편이 과제`;
  }

  return {
    currentRank: myStanding.rank,
    gapToPostseason,
    gapToTop4,
    gapToTop1,
    gamesRemaining,
    magicNumber,
    tragicNumber,
    projection,
    postseasonProbability,
    outlookComment,
  };
}

// ─── 타격 진단 (팀의 색깔 분석) ───────────────────────
export interface BattingProfile {
  topAvg: number;          // 팀 상위 5명 평균 타율
  topHR: number;           // 팀 상위 3명 홈런 합산
  topRBI: number;          // 팀 상위 3명 타점 합산
  topSB: number;           // 팀 상위 3명 도루 합산
  identityLabel: string;   // "장타형 / 컨택형 / 기동형 / 균형형"
  identityIcon: string;
  diagnosis: string;       // 야구 해설가 톤 진단
}

export function analyzeBattingProfile(
  teamName: string,
  batters: BattersData | null
): BattingProfile | null {
  if (!batters) return null;

  const teamAvg = (batters.avg || []).filter((b) => b.team === teamName).slice(0, 5);
  const teamHR = (batters.hr || []).filter((b) => b.team === teamName).slice(0, 3);
  const teamRBI = (batters.rbi || []).filter((b) => b.team === teamName).slice(0, 3);
  const teamSB = (batters.sb || []).filter((b) => b.team === teamName).slice(0, 3);

  if (teamAvg.length === 0 && teamHR.length === 0) return null;

  const avgSum = teamAvg.reduce((s, b) => s + (b.avg || 0), 0);
  const avgMean = teamAvg.length > 0 ? avgSum / teamAvg.length : 0;
  const hrSum = teamHR.reduce((s, b) => s + (b.hr || 0), 0);
  const rbiSum = teamRBI.reduce((s, b) => s + (b.rbi || 0), 0);
  const sbSum = teamSB.reduce((s, b) => s + (b.sb || 0), 0);

  // 팀 색깔 판정 (점수화)
  // - 장타: 상위3 홈런 합 (45+ 강력 / 25+ 양호)
  // - 컨택: 상위5 평균타율 (.310+ 강력 / .290+ 양호)
  // - 기동: 상위3 도루 합 (40+ 강력 / 25+ 양호)
  const powerScore = hrSum >= 45 ? 3 : hrSum >= 25 ? 2 : hrSum >= 12 ? 1 : 0;
  const contactScore = avgMean >= 0.31 ? 3 : avgMean >= 0.29 ? 2 : avgMean >= 0.27 ? 1 : 0;
  const speedScore = sbSum >= 40 ? 3 : sbSum >= 25 ? 2 : sbSum >= 12 ? 1 : 0;

  let identityLabel: string;
  let identityIcon: string;
  let diagnosis: string;

  const max = Math.max(powerScore, contactScore, speedScore);
  if (max === 0) {
    identityLabel = '재정비 필요';
    identityIcon = '⚙️';
    diagnosis = '주요 타격 카테고리에서 상위권에 이름이 부족 — 타선 재편이 시급한 구간';
  } else if (powerScore === max && powerScore >= 2) {
    identityLabel = '장타형';
    identityIcon = '💥';
    diagnosis = `한 방의 화력으로 경기를 뒤집는 타선 (상위 3인 홈런 합 ${hrSum}개). 출루가 더해질 때 폭발력이 배가됨`;
  } else if (contactScore === max && contactScore >= 2) {
    identityLabel = '컨택형';
    identityIcon = '🎯';
    diagnosis = `정교한 콘택트로 흐름을 만드는 타선 (상위 5인 평균 타율 ${avgMean.toFixed(3)}). 클러치 상황에서의 집중력이 강점`;
  } else if (speedScore === max && speedScore >= 2) {
    identityLabel = '기동형';
    identityIcon = '💨';
    diagnosis = `발로 점수를 만드는 야구 (상위 3인 도루 합 ${sbSum}개). 상대 배터리에 압박을 가하는 누적형 야구`;
  } else {
    identityLabel = '균형형';
    identityIcon = '⚖️';
    diagnosis = `장타·컨택·기동력이 고루 분포된 균형 잡힌 타선. 약점이 적어 시리즈에서 안정적`;
  }

  return {
    topAvg: Number(avgMean.toFixed(3)),
    topHR: hrSum,
    topRBI: rbiSum,
    topSB: sbSum,
    identityLabel,
    identityIcon,
    diagnosis,
  };
}

// ─── 마운드 진단 ───────────────────────
export interface PitchingProfile {
  starterERA: number;       // 팀 선발 상위 평균 ERA
  bullpenStability: number; // 0~100 (홀드/세이브 가용 인원 기반)
  topSO: number;            // 팀 상위 3명 삼진 합
  identityLabel: string;
  identityIcon: string;
  diagnosis: string;
}

export function analyzePitchingProfile(
  teamName: string,
  pitchers: PitchersData | null
): PitchingProfile | null {
  if (!pitchers) return null;

  const eraList = (pitchers.era || []).filter((p) => p.team === teamName).slice(0, 5);
  const wList = (pitchers.w || []).filter((p) => p.team === teamName).slice(0, 3);
  const soList = (pitchers.so || []).filter((p) => p.team === teamName).slice(0, 3);
  const svList = (pitchers.sv || []).filter((p) => p.team === teamName);

  if (eraList.length === 0 && soList.length === 0 && svList.length === 0) return null;

  // 선발 ERA (선발 역할만 추림, 없으면 전체 평균)
  const starters = eraList.filter((p) => p.role === '선발');
  const starterPool = starters.length > 0 ? starters : eraList;
  const eraSum = starterPool.reduce((s, p) => s + (p.era || 0), 0);
  const starterERA = starterPool.length > 0 ? eraSum / starterPool.length : 0;

  // 불펜 안정도 (마무리 1명 + 셋업 라인 가용성으로 근사)
  const closer = svList[0];
  const closerSV = closer?.sv || 0;
  const closerERA = closer?.era || 99;
  let bullpenStability =
    (closerSV >= 25 ? 35 : closerSV >= 15 ? 25 : closerSV >= 5 ? 12 : 0) +
    (closerERA <= 2.0 ? 35 : closerERA <= 3.0 ? 25 : closerERA <= 4.0 ? 15 : 5) +
    (eraList.length >= 4 ? 20 : eraList.length >= 2 ? 10 : 0) +
    (wList.length >= 3 ? 10 : 0);
  bullpenStability = Math.max(0, Math.min(100, bullpenStability));

  // 팀 삼진력
  const soSum = soList.reduce((s, p) => s + (p.so || 0), 0);

  // 마운드 색깔 판정
  let identityLabel: string;
  let identityIcon: string;
  let diagnosis: string;

  // 점수: 선발(낮은 ERA가 좋음), 불펜(높은 안정도), 탈삼진(높은 합)
  const starterScore = starterERA > 0 ? (starterERA <= 3.0 ? 3 : starterERA <= 3.8 ? 2 : starterERA <= 4.5 ? 1 : 0) : 0;
  const bullpenScore = bullpenStability >= 75 ? 3 : bullpenStability >= 55 ? 2 : bullpenStability >= 35 ? 1 : 0;
  const soScore = soSum >= 350 ? 3 : soSum >= 220 ? 2 : soSum >= 130 ? 1 : 0;

  const max = Math.max(starterScore, bullpenScore, soScore);
  if (max === 0) {
    identityLabel = '재정비 필요';
    identityIcon = '⚠️';
    diagnosis = '선발·불펜·탈삼진 어느 축에서도 상위권 지표가 부족 — 마운드 리빌딩 구간';
  } else if (starterScore === max && starterScore >= 2) {
    identityLabel = '선발 강세';
    identityIcon = '🎯';
    diagnosis = `선발진이 시즌을 끌고 가는 팀 (상위 선발 평균 ERA ${starterERA.toFixed(2)}). 긴 이닝 책임투구로 불펜 부담을 줄이는 야구`;
  } else if (bullpenScore === max && bullpenScore >= 2) {
    identityLabel = '불펜 야구';
    identityIcon = '🔥';
    diagnosis = `중후반 마운드 운영이 강점 (마무리 ${closerSV}세이브, ERA ${closerERA.toFixed(2)}). 리드 상황 승률이 높은 모범적 운영`;
  } else if (soScore === max && soScore >= 2) {
    identityLabel = '탈삼진 마운드';
    identityIcon = '⚡';
    diagnosis = `상위 3인 합산 ${soSum}K — 위기 상황을 헛스윙으로 끊는 파워피칭. 시즌 후반 체력 관리가 변수`;
  } else {
    identityLabel = '균형형';
    identityIcon = '⚖️';
    diagnosis = `선발·불펜 균형이 잡힌 마운드. 결정적 한 방이 아닌 누적된 안정감으로 승리를 챙기는 스타일`;
  }

  return {
    starterERA: Number(starterERA.toFixed(2)),
    bullpenStability: Math.round(bullpenStability),
    topSO: soSum,
    identityLabel,
    identityIcon,
    diagnosis,
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

// ─── 종합 진단 (강점/약점/과제) ───────────────────────
export interface ScoutingDiagnosis {
  strength: string;      // 강점
  weakness: string;      // 약점
  agenda: string;        // 다음 과제 (시즌 후반 키워드)
}

function buildDiagnosis(
  form: TeamForm,
  outlook: RankOutlook,
  batting: BattingProfile | null,
  pitching: PitchingProfile | null
): ScoutingDiagnosis {
  // ─ 강점: 가장 두드러진 축을 채택
  let strength: string;
  if (form.momentum >= 65) {
    strength = `최근 흐름 — 모멘텀 ${form.momentum}점의 ${form.momentumLabel}, ${form.last10Record}`;
  } else if (batting && batting.identityLabel !== '재정비 필요' && batting.identityLabel !== '균형형') {
    strength = `타선의 색깔 — ${batting.identityIcon} ${batting.identityLabel} (상위 5인 평균 타율 ${batting.topAvg.toFixed(3)})`;
  } else if (pitching && pitching.identityLabel !== '재정비 필요' && pitching.identityLabel !== '균형형') {
    strength = `마운드 — ${pitching.identityIcon} ${pitching.identityLabel} (선발 ERA ${pitching.starterERA.toFixed(2)})`;
  } else if (form.homeWinRate >= 0.6) {
    strength = `홈 경기 강세 — 홈 승률 ${(form.homeWinRate * 100).toFixed(0)}%로 안방을 지배`;
  } else if (outlook.currentRank <= 3) {
    strength = `상위권 정착 — 현재 ${outlook.currentRank}위로 자동진출권 사수 중`;
  } else if (batting) {
    strength = `타격 — ${batting.identityIcon} ${batting.identityLabel}`;
  } else {
    strength = `잠재력 — 시즌이 진행되면서 색깔이 드러나는 구간`;
  }

  // ─ 약점: 가장 부족한 축
  let weakness: string;
  if (form.trend === 'down' && form.momentum < 35) {
    weakness = `모멘텀 — 최근 10경기 ${form.last10Record}, ${form.momentumLabel} 흐름`;
  } else if (pitching && pitching.identityLabel === '재정비 필요') {
    weakness = `마운드 — 상위권 투수 풀이 얇아 시즌 후반 변수`;
  } else if (batting && batting.identityLabel === '재정비 필요') {
    weakness = `타선 — 상위권에 이름이 부족, 득점 생산력 보강 필요`;
  } else if (form.homeAwayGap >= 0.2) {
    weakness = `원정 — 원정 승률 ${(form.awayWinRate * 100).toFixed(0)}%로 홈 대비 큰 편차`;
  } else if (form.homeAwayGap <= -0.2) {
    weakness = `홈 — 홈 승률 ${(form.homeWinRate * 100).toFixed(0)}%로 안방 응집력 약화`;
  } else if (pitching && pitching.bullpenStability < 45) {
    weakness = `불펜 — 안정도 ${pitching.bullpenStability}점, 마무리·셋업 보강 필요`;
  } else if (outlook.gapToPostseason > 5) {
    weakness = `포스트시즌 격차 — 5위와 ${outlook.gapToPostseason}게임차로 추격이 만만치 않음`;
  } else {
    weakness = `결정력 — 큰 약점은 보이지 않으나, 박빙 승부에서의 결정구가 변수`;
  }

  // ─ 다음 과제
  let agenda: string;
  if (outlook.currentRank === 1) {
    agenda = `정규시즌 1위 굳히기 — KS 직행 확정 시점까지 핵심 전력 체력 관리`;
  } else if (outlook.currentRank <= 4) {
    agenda = `${outlook.currentRank - 1}위 도약 / ${outlook.currentRank + 1}위 따돌리기 — 직접 맞대결 승점 사냥`;
  } else if (outlook.currentRank === 5) {
    agenda = `5위 굳히기 — 6위 추격팀과의 잔여 맞대결이 와카 진출의 분기점`;
  } else if (outlook.tragicNumber !== null && outlook.tragicNumber <= 20) {
    agenda = `5위 추격 — 잔여 ${outlook.gamesRemaining}경기에서 ${outlook.tragicNumber}승 이상이 진출 마지노선`;
  } else if (outlook.currentRank <= 7) {
    agenda = `상위권 추격 — 상위팀과의 직접 맞대결에서 5할 이상 승률이 필수`;
  } else {
    agenda = `리빌딩 모드 — 유망주 등용과 내년 시즌 라인업 정비`;
  }

  return { strength, weakness, agenda };
}

// ─── 종합 리포트 ───────────────────────────
export interface TeamReport {
  team: string;
  form: TeamForm;
  outlook: RankOutlook;
  batting: BattingProfile | null;
  pitching: PitchingProfile | null;
  topPlayers: TopPlayers;
  recentGames: RecentGame[];
  insight: string;       // 헤드라인 (야구 해설가 톤)
  diagnosis: ScoutingDiagnosis;
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
  const batting = analyzeBattingProfile(teamName, batters);
  const pitching = analyzePitchingProfile(teamName, pitchers);
  const topPlayers = findTopPlayers(teamName, batters, pitchers);
  const recentGames = findRecentGames(teamName, games);
  const diagnosis = buildDiagnosis(form, outlook, batting, pitching);

  // ─ 헤드라인 인사이트 (야구 해설가 톤, 다축 결합)
  let insight = '';

  const battingStrong = batting && batting.identityLabel !== '재정비 필요' && batting.identityLabel !== '균형형';
  const pitchingStrong = pitching && pitching.identityLabel !== '재정비 필요' && pitching.identityLabel !== '균형형';
  const battingWeak = batting && batting.identityLabel === '재정비 필요';
  const pitchingWeak = pitching && pitching.identityLabel === '재정비 필요';

  if (form.trend === 'up' && outlook.currentRank <= 3) {
    if (battingStrong && pitchingStrong) {
      insight = `🔥 타선의 ${batting!.identityLabel} 화력과 ${pitching!.identityLabel} 마운드가 동시에 가동되며 상위권을 굳히는 흐름`;
    } else if (battingStrong) {
      insight = `🔥 ${batting!.identityIcon} ${batting!.identityLabel} 타선이 상승세를 이끌며 ${outlook.currentRank}위를 사수`;
    } else if (pitchingStrong) {
      insight = `🔥 ${pitching!.identityIcon} ${pitching!.identityLabel}이 시즌을 지탱하며 상위권 흐름 지속`;
    } else {
      insight = `🔥 상승세 + ${outlook.currentRank}위 — 가을야구 자동진출권을 굳혀가는 구간`;
    }
  } else if (form.trend === 'up' && outlook.currentRank <= 5) {
    insight = `💪 ${form.momentumLabel} 흐름을 타고 와일드카드권을 정조준 중. 잔여 ${outlook.gamesRemaining}경기 페이스가 관건`;
  } else if (form.trend === 'up') {
    insight = `📈 부상 회복기 — 최근 ${form.last10Record}로 분위기 반전, 추격의 동력 확보`;
  } else if (form.trend === 'down' && outlook.currentRank <= 5 && outlook.gapToPostseason <= 2) {
    insight = `⚠️ 포스트시즌권 유지 중이나 ${form.momentumLabel} 흐름 — 추격팀과의 직접 맞대결이 분수령`;
  } else if (form.trend === 'down' && pitchingWeak) {
    insight = `❄️ 마운드 재정비가 필요한 시점 — 타선이 살아도 실점 부담이 발목을 잡는 구간`;
  } else if (form.trend === 'down' && battingWeak) {
    insight = `❄️ 타선의 무게감 회복이 급선무 — 득점 생산력 없이는 마운드도 무너지기 쉬운 흐름`;
  } else if (form.trend === 'down') {
    insight = `😥 ${form.momentumLabel} — 클러치 상황 집중력 회복과 홈 응집력 복원이 키`;
  } else {
    // steady
    if (outlook.currentRank <= 4) {
      insight = `⚖️ 꾸준한 ${outlook.currentRank}위권 페이스 — 직접 맞대결에서 +α를 만들면 한 계단 도약 가능`;
    } else if (outlook.currentRank === 5) {
      insight = `⚖️ 와일드카드권 사수 — 안정세 속에 추격팀을 따돌리는 1~2경기가 시즌 향방을 가름`;
    } else {
      insight = `⚖️ 안정세 유지 중 — 변수가 필요한 시점, 클러치 상황과 마운드 운용이 분수령`;
    }
  }

  return {
    team: teamName,
    form,
    outlook,
    batting,
    pitching,
    topPlayers,
    recentGames,
    insight,
    diagnosis,
  };
}
