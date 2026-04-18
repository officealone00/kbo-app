/**
 * KBO 리그 스크래퍼
 *
 * KBO 공식 사이트(koreabaseball.com)에서 HTML 테이블을 긁어
 * JSON 파일로 저장한다.
 *
 * 출력:
 *   data/standings.json   - 팀 순위
 *   data/batters.json     - 타자 Top 30 (타율/홈런/타점/도루)
 *   data/pitchers.json    - 투수 Top 30 (방어율/승/삼진/세이브)
 *   data/games.json       - 오늘/어제 경기 결과
 *   data/meta.json        - 업데이트 타임스탬프
 */

import { writeFile, mkdir } from "node:fs/promises";
import { load } from "cheerio";

const DATA_DIR = new URL("../data/", import.meta.url);

// ─── 공통 유틸 ──────────────────────────────────
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
const num = (s) => {
  const v = parseFloat(clean(s).replace(/[^\d.-]/g, ""));
  return Number.isFinite(v) ? v : 0;
};
const int = (s) => {
  const v = parseInt(clean(s).replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(v) ? v : 0;
};

// ─── 1. 팀 순위 ──────────────────────────────────
async function scrapeStandings() {
  const url =
    "https://www.koreabaseball.com/Record/TeamRank/TeamRankDaily.aspx";
  const html = await fetchHtml(url);
  const $ = load(html);

  // 테이블 헤더: 순위, 팀명, 경기, 승, 패, 무, 승률, 게임차, 최근10경기, 연속, 홈, 방문
  const rows = [];
  $("table.tData tbody tr, .record-table tbody tr, table tbody tr").each(
    (_, tr) => {
      const tds = $(tr).find("td");
      if (tds.length < 8) return;
      const rank = int($(tds[0]).text());
      const team = clean($(tds[1]).text());
      if (!team || !rank) return;
      // 팀명이 10개 한정 (중복 방지)
      if (rows.find((r) => r.team === team)) return;
      rows.push({
        rank,
        team,
        games: int($(tds[2]).text()),
        wins: int($(tds[3]).text()),
        losses: int($(tds[4]).text()),
        draws: int($(tds[5]).text()),
        winRate: num($(tds[6]).text()),
        gamesBehind: num($(tds[7]).text()),
        last10: clean($(tds[8]).text()),
        streak: clean($(tds[9]).text()),
        home: clean($(tds[10]).text()),
        away: clean($(tds[11]).text()),
      });
    }
  );

  // KBO는 10팀이므로 10개 이상 되면 앞 10개만
  const top10 = rows.slice(0, 10);
  if (top10.length < 10) {
    console.warn(`⚠️  standings: 팀 ${top10.length}개만 파싱됨`);
  }
  console.log(`✅ standings: ${top10.length}팀`);
  return top10;
}

// ─── 2. 타자 순위 ────────────────────────────────
// 카테고리별로 정렬된 페이지를 각각 긁는다
const HITTER_SORTS = {
  avg: "HRA_RT", // 타율
  hr: "HR_CN", // 홈런
  rbi: "RBI_CN", // 타점
  h: "HIT_CN", // 안타
};

async function scrapeHitterCategory(sort) {
  const url = `https://www.koreabaseball.com/Record/Player/HitterBasic/Basic1.aspx?sort=${sort}`;
  const html = await fetchHtml(url);
  const $ = load(html);

  const rows = [];
  // 타자 기본기록 테이블: 순위, 선수명, 팀명, AVG, G, PA, AB, R, H, 2B, 3B, HR, TB, RBI, SAC, SF
  $("table tbody tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 14) return;
    const rank = int($(tds[0]).text());
    const name = clean($(tds[1]).text());
    const team = clean($(tds[2]).text());
    if (!rank || !name || !team) return;
    rows.push({
      rank,
      name,
      team,
      avg: num($(tds[3]).text()),
      games: int($(tds[4]).text()),
      pa: int($(tds[5]).text()),
      ab: int($(tds[6]).text()),
      r: int($(tds[7]).text()),
      h: int($(tds[8]).text()),
      doubles: int($(tds[9]).text()),
      triples: int($(tds[10]).text()),
      hr: int($(tds[11]).text()),
      tb: int($(tds[12]).text()),
      rbi: int($(tds[13]).text()),
    });
  });

  return rows.slice(0, 30);
}

async function scrapeBatters() {
  // 타율(기본)만 긁어도 4가지 스탯이 다 있으므로, 정렬만 다르게 4번 요청할 필요 없음
  // → 타율 기준 Top 30 + 전체 데이터를 모두 저장
  const avgTop = await scrapeHitterCategory(HITTER_SORTS.avg);
  const hrTop = await scrapeHitterCategory(HITTER_SORTS.hr);
  const rbiTop = await scrapeHitterCategory(HITTER_SORTS.rbi);

  // 도루(SB)는 Basic2 페이지에 있음
  const sbTop = await scrapeHitterBasic2();

  console.log(
    `✅ batters: 타율 ${avgTop.length}, 홈런 ${hrTop.length}, 타점 ${rbiTop.length}, 도루 ${sbTop.length}`
  );

  return {
    avg: avgTop,
    hr: hrTop,
    rbi: rbiTop,
    sb: sbTop,
  };
}

async function scrapeHitterBasic2() {
  // Basic2: SLG, OBP, OPS, MH, RISP, PH_BA, SB (도루 포함)
  const url =
    "https://www.koreabaseball.com/Record/Player/HitterBasic/Basic2.aspx?sort=SB_CN";
  try {
    const html = await fetchHtml(url);
    const $ = load(html);
    const rows = [];
    $("table tbody tr").each((_, tr) => {
      const tds = $(tr).find("td");
      if (tds.length < 10) return;
      const rank = int($(tds[0]).text());
      const name = clean($(tds[1]).text());
      const team = clean($(tds[2]).text());
      if (!rank || !name || !team) return;
      // Basic2 컬럼: 순위, 선수명, 팀명, AVG, G, PA, GO/AO, 멀티안타, RISP, PH_BA, ... SB
      // SB는 대개 마지막 즈음에 있음. 안전하게 마지막 5개 중에서 숫자 찾기
      const sb = int($(tds[tds.length - 1]).text());
      rows.push({
        rank,
        name,
        team,
        sb,
        avg: num($(tds[3]).text()),
      });
    });
    return rows.slice(0, 30);
  } catch (e) {
    console.warn(`⚠️  Basic2 (도루) 스크래핑 실패:`, e.message);
    return [];
  }
}

// ─── 3. 투수 순위 ────────────────────────────────
async function scrapePitcherCategory(sort) {
  const url = `https://www.koreabaseball.com/Record/Player/PitcherBasic/Basic1.aspx?sort=${sort}`;
  const html = await fetchHtml(url);
  const $ = load(html);

  const rows = [];
  // 투수 기본기록: 순위, 선수명, 팀명, ERA, G, W, L, SV, HLD, WPCT, IP, H, HR, BB, HBP, SO, R, ER, WHIP
  $("table tbody tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 15) return;
    const rank = int($(tds[0]).text());
    const name = clean($(tds[1]).text());
    const team = clean($(tds[2]).text());
    if (!rank || !name || !team) return;

    const g = int($(tds[4]).text());
    const w = int($(tds[5]).text());
    const sv = int($(tds[7]).text());
    const hld = int($(tds[8]).text());

    // 역할 구분 (파생 데이터)
    // - 세이브 5개 이상: 마무리
    // - 홀드 5개 이상: 불펜
    // - W + L 기준 경기 수의 절반 이상이 완투완봉/선발: 선발
    // 단순 휴리스틱
    let role = "선발";
    if (sv >= 3) role = "마무리";
    else if (hld >= 3) role = "불펜";
    else if (w + int($(tds[6]).text()) < g * 0.5) role = "불펜";

    rows.push({
      rank,
      name,
      team,
      era: num($(tds[3]).text()),
      g,
      w,
      l: int($(tds[6]).text()),
      sv,
      hld,
      winRate: num($(tds[9]).text()),
      ip: num($(tds[10]).text()),
      h: int($(tds[11]).text()),
      hr: int($(tds[12]).text()),
      bb: int($(tds[13]).text()),
      so: int($(tds[15] || tds[14]).text()),
      role,
    });
  });

  return rows.slice(0, 30);
}

async function scrapePitchers() {
  // ERA, W, SO, SV 기준으로 각각 긁기
  const PITCHER_SORTS = {
    era: "ERA_RT",
    w: "W_CN",
    so: "SO_CN",
    sv: "SV_CN",
  };
  const era = await scrapePitcherCategory(PITCHER_SORTS.era);
  const w = await scrapePitcherCategory(PITCHER_SORTS.w);
  const so = await scrapePitcherCategory(PITCHER_SORTS.so);
  const sv = await scrapePitcherCategory(PITCHER_SORTS.sv);

  console.log(
    `✅ pitchers: 방어율 ${era.length}, 승 ${w.length}, 삼진 ${so.length}, 세이브 ${sv.length}`
  );

  return { era, w, so, sv };
}

// ─── 4. 오늘/어제 경기 결과 ──────────────────────
async function scrapeGames() {
  // ScoreBoard.aspx 페이지는 당일 경기를 보여준다
  // 어제 경기는 Schedule.aspx?date=YYYYMMDD 형식으로 접근
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const fmt = (d) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
      d.getDate()
    ).padStart(2, "0")}`;

  async function scrapeByDate(date) {
    const dateStr = fmt(date);
    const url = `https://www.koreabaseball.com/Schedule/ScoreBoard.aspx?searchScDate=${dateStr}`;
    try {
      const html = await fetchHtml(url);
      const $ = load(html);
      const games = [];
      // 스코어보드 페이지 구조는 경기 카드 형태
      // 각 경기는 tbl_board, game_schedule 등의 class를 가짐
      $(
        ".smsScore, .scoreBoard, .gameCenter_table, table.tbl_board, .score_board"
      ).each((_, el) => {
        const text = clean($(el).text());
        if (!text) return;
        games.push({ raw: text, date: dateStr });
      });

      // 더 간단한 접근: 팀 이름을 포함하는 td 쌍 찾기
      const teams = [
        "삼성",
        "LG",
        "KT",
        "SSG",
        "KIA",
        "NC",
        "한화",
        "롯데",
        "두산",
        "키움",
      ];
      // 페어링된 경기를 가장 확실하게 가져올 수 있도록 텍스트 기반 파싱
      // 실패해도 페이지 로드 자체는 성공하면 일단 메타데이터 반환
      return { date: dateStr, games };
    } catch (e) {
      console.warn(`⚠️  ${dateStr} 경기 스크래핑 실패:`, e.message);
      return { date: dateStr, games: [] };
    }
  }

  const [todayData, yesterdayData] = await Promise.all([
    scrapeByDate(today),
    scrapeByDate(yesterday),
  ]);

  console.log(
    `✅ games: 오늘 ${todayData.games.length}건, 어제 ${yesterdayData.games.length}건`
  );

  return {
    today: todayData,
    yesterday: yesterdayData,
  };
}

// ─── 메인 ───────────────────────────────────────
async function writeJson(name, data) {
  const path = new URL(`${name}.json`, DATA_DIR);
  await writeFile(path, JSON.stringify(data, null, 2), "utf8");
  console.log(`  📄 data/${name}.json 저장 완료`);
}

async function main() {
  console.log("🏟️  KBO 데이터 스크래핑 시작\n");
  console.log(`⏰ ${new Date().toISOString()}\n`);

  await mkdir(DATA_DIR, { recursive: true });

  const results = {
    standings: null,
    batters: null,
    pitchers: null,
    games: null,
  };
  const errors = [];

  try {
    results.standings = await scrapeStandings();
    await writeJson("standings", results.standings);
  } catch (e) {
    errors.push(`standings: ${e.message}`);
    console.error("❌ standings 실패:", e.message);
  }

  try {
    results.batters = await scrapeBatters();
    await writeJson("batters", results.batters);
  } catch (e) {
    errors.push(`batters: ${e.message}`);
    console.error("❌ batters 실패:", e.message);
  }

  try {
    results.pitchers = await scrapePitchers();
    await writeJson("pitchers", results.pitchers);
  } catch (e) {
    errors.push(`pitchers: ${e.message}`);
    console.error("❌ pitchers 실패:", e.message);
  }

  try {
    results.games = await scrapeGames();
    await writeJson("games", results.games);
  } catch (e) {
    errors.push(`games: ${e.message}`);
    console.error("❌ games 실패:", e.message);
  }

  const meta = {
    updatedAt: new Date().toISOString(),
    updatedAtKST: new Date().toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
    }),
    season: new Date().getFullYear(),
    errors,
    success:
      (results.standings ? 1 : 0) +
      (results.batters ? 1 : 0) +
      (results.pitchers ? 1 : 0) +
      (results.games ? 1 : 0),
    total: 4,
  };
  await writeJson("meta", meta);

  console.log(`\n${meta.success === 4 ? "✅" : "⚠️"} 완료: ${meta.success}/${meta.total} 성공`);
  if (errors.length) {
    console.error("에러:", errors);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("치명적 에러:", e);
  process.exit(1);
});
