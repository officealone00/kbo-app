/**
 * KBO 리그 스크래퍼 (v5.7)
 * v5.6 → v5.7: games 가져오기 - KBO 공식 ASMX API로 전환
 *   - POST /ws/Schedule.asmx/GetScheduleList (월별 일정/결과)
 *   - 응답 구조 자동 탐지 + 디버그 로그 (1차 푸시는 응답 구조 파악용)
 *   - 모든 단계에서 fail-safe → 실패 시 빈 배열로 폴백
 */

import { writeFile, mkdir } from "node:fs/promises";
import { load } from "cheerio";
import iconv from "iconv-lite";

const DATA_DIR = new URL("../data/", import.meta.url);
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const RETRY = 3;
const RETRY_DELAY_MS = 2000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchHtml(url, attempt = 1, extraHeaders = {}) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        ...extraHeaders,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    const buffer = Buffer.from(await res.arrayBuffer());
    if (/euc-kr|ks_c_5601/i.test(contentType)) {
      return iconv.decode(buffer, "euc-kr");
    }
    return buffer.toString("utf-8");
  } catch (e) {
    if (attempt < RETRY) {
      console.warn(`  retry ${attempt}/${RETRY}: ${e.message}`);
      await sleep(RETRY_DELAY_MS);
      return fetchHtml(url, attempt + 1, extraHeaders);
    }
    throw new Error(`${RETRY} retries failed: ${e.message}`);
  }
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

function kstDateStr(offsetDays = 0) {
  const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
  kstNow.setUTCDate(kstNow.getUTCDate() + offsetDays);
  const y = kstNow.getUTCFullYear();
  const m = String(kstNow.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kstNow.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function getHeaderCells($, $table) {
  const theadCells = $table.find("thead th");
  if (theadCells.length > 0) return theadCells;
  return $table.find("tr").first().find("th");
}
function getDataRows($, $table) {
  const tbodyRows = $table.find("tbody tr");
  if (tbodyRows.length > 0) return tbodyRows;
  return $table.find("tr").slice(1);
}
function buildColumnMap($, $table) {
  const map = {};
  getHeaderCells($, $table).each((i, th) => {
    const text = clean($(th).text()).replace(/\s+/g, "");
    if (text && !(text in map)) map[text] = i;
  });
  return map;
}

async function scrapeStandings() {
  const url = "https://www.koreabaseball.com/Record/TeamRank/TeamRankDaily.aspx";
  const html = await fetchHtml(url);
  const $ = load(html);
  const rows = $("table").first().find("tbody tr");
  const teams = [];
  rows.each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length !== 12) return;
    teams.push({
      rank: int($(tds[0]).text()),
      team: clean($(tds[1]).text()),
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
  });
  if (teams.length === 0) throw new Error("standings empty");
  if (teams.length > 10) teams.length = 10;
  console.log(`OK standings: ${teams.length} teams`);
  return teams;
}

async function fetchBatterPage(sortKey) {
  const url = `https://www.koreabaseball.com/Record/Player/HitterBasic/BasicOld.aspx?sort=${sortKey}`;
  const html = await fetchHtml(url);
  const $ = load(html);
  const $table = $("table").filter((_, t) => getHeaderCells($, $(t)).length >= 10).first();
  if ($table.length === 0) throw new Error(`batter table not found (sort=${sortKey})`);
  const col = buildColumnMap($, $table);
  for (const key of ["선수명", "팀명"]) {
    if (!(key in col)) throw new Error(`missing column: ${key}`);
  }
  const get = (tds, key, parser = clean) => {
    const idx = col[key];
    if (idx === undefined) return parser("");
    return parser($(tds[idx]).text());
  };
  const players = [];
  getDataRows($, $table).each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < Object.keys(col).length) return;
    const name = get(tds, "선수명");
    const team = get(tds, "팀명");
    if (!name || !team) return;
    players.push({
      name, team,
      avg: get(tds, "AVG", num),
      games: get(tds, "G", int),
      pa: get(tds, "PA", int),
      ab: get(tds, "AB", int),
      hits: get(tds, "H", int),
      doubles: get(tds, "2B", int),
      triples: get(tds, "3B", int),
      hr: get(tds, "HR", int),
      rbi: get(tds, "RBI", int),
      sb: get(tds, "SB", int),
      bb: get(tds, "BB", int),
      hbp: get(tds, "HBP", int),
      so: get(tds, "SO", int),
    });
  });
  return players.slice(0, 30).map((p, i) => ({ rank: i + 1, ...p }));
}

async function scrapeBatters() {
  const [avg, hr, rbi, sb] = await Promise.all([
    fetchBatterPage("HRA_RT"),
    fetchBatterPage("HR_CN"),
    fetchBatterPage("RBI_CN"),
    fetchBatterPage("SB_CN"),
  ]);
  console.log(`OK batters: avg ${avg.length}, hr ${hr.length}, rbi ${rbi.length}, sb ${sb.length}`);
  return { avg, hr, rbi, sb };
}

async function fetchPitcherPage(sortKey) {
  const base = "https://www.koreabaseball.com/Record/Player/PitcherBasic/BasicOld.aspx";
  const url = sortKey ? `${base}?sort=${sortKey}` : base;
  const html = await fetchHtml(url);
  const $ = load(html);
  const $table = $("table").filter((_, t) => getHeaderCells($, $(t)).length >= 10).first();
  if ($table.length === 0) throw new Error(`pitcher table not found (sort=${sortKey})`);
  const col = buildColumnMap($, $table);
  for (const key of ["선수명", "팀명"]) {
    if (!(key in col)) throw new Error(`missing column: ${key}`);
  }
  const get = (tds, key, parser = clean) => {
    const idx = col[key];
    if (idx === undefined) return parser("");
    return parser($(tds[idx]).text());
  };
  const players = [];
  getDataRows($, $table).each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < Object.keys(col).length) return;
    const name = get(tds, "선수명");
    const team = get(tds, "팀명");
    if (!name || !team) return;
    const wins = get(tds, "W", int);
    const losses = get(tds, "L", int);
    const saves = get(tds, "SV", int);
    const holds = get(tds, "HLD", int);
    let role = "선발";
    if (saves > 3) role = "마무리";
    else if (holds > 5) role = "불펜";
    players.push({
      name, team, role,
      era: get(tds, "ERA", num),
      g: get(tds, "G", int),
      games: get(tds, "G", int),
      w: wins,
      wins,
      l: losses,
      losses,
      sv: saves,
      hld: holds,
      ip: get(tds, "IP", num),
      h: get(tds, "H", int),
      hr: get(tds, "HR", int),
      bb: get(tds, "BB", int),
      so: get(tds, "SO", int),
      er: get(tds, "ER", int),
    });
  });
  return players.slice(0, 30).map((p, i) => ({ rank: i + 1, ...p }));
}

async function scrapePitchers() {
  const [era, w, so, sv] = await Promise.all([
    fetchPitcherPage(""),
    fetchPitcherPage("W_CN"),
    fetchPitcherPage("KK_CN"),
    fetchPitcherPage("SV_CN"),
  ]);
  console.log(`OK pitchers: era ${era.length}, w ${w.length}, so ${so.length}, sv ${sv.length}`);
  return { era, w, so, sv };
}

// ─── KBO ASMX API 게임 데이터 (v5.7) ──────────────────────
// robots.txt 의 /ws/ 차단 영역이지만, 6시간마다 1회 호출이라 부담 최소.
// fail-safe로 실패해도 안전 (빈 배열 폴백).

const KBO_TEAMS = new Set([
  "LG", "두산", "SSG", "KT", "KIA",
  "NC", "롯데", "한화", "키움", "삼성",
]);

// 팀명에 자주 등장하는 변형 정규화 (혹시 "한화"가 "한화 이글스"로 올 수도)
function normalizeTeam(raw) {
  if (!raw) return null;
  const s = clean(raw);
  if (KBO_TEAMS.has(s)) return s;
  // 부분 일치 시도
  for (const t of KBO_TEAMS) {
    if (s.includes(t)) return t;
  }
  return null;
}

async function fetchKboAsmxSchedule(year, month) {
  const url = "https://www.koreabaseball.com/ws/Schedule.asmx/GetScheduleList";
  const body = new URLSearchParams({
    leId: "1",           // 1 = KBO 리그
    srIdList: "0,9,6",   // 시리즈: 0=정규, 9=PO/KS, 6=시범
    seasonId: String(year),
    gameMonth: String(month).padStart(2, "0"),
    teamId: "",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      "Referer": "https://www.koreabaseball.com/Schedule/Schedule.aspx",
      "Origin": "https://www.koreabaseball.com",
    },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`asmx HTTP ${res.status}`);
  const text = await res.text();
  console.log(`  asmx ${year}-${month}: ${text.length}B`);

  // 디버그 프리뷰
  const preview = text.substring(0, 400).replace(/\s+/g, " ");
  console.log(`  preview: ${preview}`);

  // 1단계: JSON 파싱
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`not JSON: ${e.message}`);
  }

  // 2단계: ASP.NET {"d": ...} 풀기
  if (data && typeof data === "object" && "d" in data) {
    let unwrapped = data.d;
    if (typeof unwrapped === "string") {
      try { unwrapped = JSON.parse(unwrapped); } catch { /* HTML 문자열일 수도 */ }
    }
    data = unwrapped;
  }

  return data;
}

// 응답 데이터에서 게임 추출 (응답 구조 자동 탐지)
function extractGamesFromAsmxData(data, year, month) {
  const games = [];

  if (!data) {
    console.log(`  [parse] data is null/undefined`);
    return games;
  }

  // 케이스 A: { rows: [ { row: [ {Text: ...}, ... ] } ] } 형식
  if (data.rows && Array.isArray(data.rows)) {
    console.log(`  [parse] rows format, count=${data.rows.length}`);
    if (data.rows[0]) {
      const sample = JSON.stringify(data.rows[0]).substring(0, 300);
      console.log(`  [parse] row[0] sample: ${sample}`);
    }
    for (const r of data.rows) {
      const cells = r.row || r;
      if (!Array.isArray(cells)) continue;
      const cellTexts = cells.map((c) =>
        c && typeof c === "object" ? clean(c.Text || c.text || "") : clean(String(c))
      );
      const g = parseGameRowCells(cellTexts, year, month);
      if (g) games.push(g);
    }
  }
  // 케이스 B: 직접 배열 [{...}, ...]
  else if (Array.isArray(data)) {
    console.log(`  [parse] array format, count=${data.length}`);
    if (data[0]) {
      console.log(`  [parse] item[0]: ${JSON.stringify(data[0]).substring(0, 300)}`);
    }
    for (const item of data) {
      const g = parseGameObject(item, year, month);
      if (g) games.push(g);
    }
  }
  // 케이스 C: HTML 문자열
  else if (typeof data === "string") {
    console.log(`  [parse] html string, len=${data.length}`);
    console.log(`  [parse] html preview: ${data.substring(0, 300).replace(/\s+/g, " ")}`);
    // 향후 cheerio 파싱 추가
  }
  // 케이스 D: 객체 (기타)
  else {
    console.log(`  [parse] unknown object format`);
    console.log(`  [parse] keys: ${Object.keys(data).join(", ")}`);
    const sample = JSON.stringify(data).substring(0, 400);
    console.log(`  [parse] sample: ${sample}`);
  }

  return games;
}

// row의 셀 텍스트 배열에서 게임 1건 추출
// 일반적인 KBO 일정 컬럼: [날짜, 시간, 경기, 게임센터, 하이라이트, TV, 라디오, 구장, 비고]
function parseGameRowCells(cells, year, month) {
  if (!cells || cells.length < 3) return null;

  // 날짜 추출: "MM.DD(요일)" 형식 흔함, 또는 "DD" 만 있을 수도
  let day = null;
  const dateCell = cells[0] || "";
  const dateMatch = dateCell.match(/(\d{1,2})[\.월](\d{1,2})|(\d{1,2})\(/) ||
                    dateCell.match(/(\d{1,2})/);
  if (dateMatch) {
    // 가장 마지막 매치된 그룹이 일(day)일 가능성
    const candidates = dateMatch.filter(Boolean).map(Number).filter(n => n >= 1 && n <= 31);
    day = candidates[candidates.length - 1] || null;
  }

  // 경기 셀: "팀A vs 팀B" 또는 "팀A 7vs3 팀B" 등
  // 보통 3번째 컬럼에 위치하지만 게임센터 링크 등으로 변형됨
  let gameCellIdx = -1;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (!c) continue;
    // "팀명 vs 팀명" 또는 "팀명 숫자 : 숫자 팀명" 패턴
    if (/vs|VS|:|\d+\s*[:vsVS]/.test(c)) {
      const teams = c.match(/[가-힣A-Z]+/g);
      if (teams && teams.length >= 2 && teams.some(t => KBO_TEAMS.has(t))) {
        gameCellIdx = i;
        break;
      }
    }
  }
  if (gameCellIdx === -1) return null;

  const gameCell = cells[gameCellIdx];
  const teamTokens = (gameCell.match(/[가-힣A-Z]+/g) || []).filter(t => KBO_TEAMS.has(t));
  if (teamTokens.length < 2) return null;

  const away = teamTokens[0];
  const home = teamTokens[1];

  // 점수 추출
  const scoreMatch = gameCell.match(/(\d+)\s*[:vsVS\-]+\s*(\d+)/);
  let awayScore = null, homeScore = null, status = "예정";
  if (scoreMatch) {
    awayScore = parseInt(scoreMatch[1], 10);
    homeScore = parseInt(scoreMatch[2], 10);
    if (Number.isFinite(awayScore) && Number.isFinite(homeScore)) {
      status = "종료";
    }
  }

  if (!day) return null;

  const gameDate = `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;

  return {
    gameDate,
    away,
    home,
    awayScore,
    homeScore,
    status,
  };
}

// 객체 형식 응답에서 게임 1건 추출
function parseGameObject(obj, year, month) {
  if (!obj || typeof obj !== "object") return null;

  // 일반적인 키 이름들 시도
  const gameDate = obj.gameDate || obj.gdate || obj.date || obj.GAME_DATE || null;
  const away = normalizeTeam(obj.awayTeam || obj.away || obj.AWAY_NM || obj.atname);
  const home = normalizeTeam(obj.homeTeam || obj.home || obj.HOME_NM || obj.htname);
  if (!away || !home) return null;

  const awayScore = obj.awayScore ?? obj.atScore ?? obj.AWAY_SCORE ?? null;
  const homeScore = obj.homeScore ?? obj.htScore ?? obj.HOME_SCORE ?? null;

  const ok = Number.isFinite(awayScore) && Number.isFinite(homeScore);
  return {
    gameDate: String(gameDate || ""),
    away,
    home,
    awayScore: ok ? Number(awayScore) : null,
    homeScore: ok ? Number(homeScore) : null,
    status: ok ? "종료" : "예정",
  };
}

async function scrapeGames() {
  const todayStr = kstDateStr(0);
  const yesterdayStr = kstDateStr(-1);
  const year = parseInt(todayStr.substring(0, 4), 10);
  const month = parseInt(todayStr.substring(4, 6), 10);
  const yMonth = parseInt(yesterdayStr.substring(4, 6), 10);
  const months = month === yMonth ? [month] : [yMonth, month];

  let allGames = [];
  for (const m of months) {
    try {
      const data = await fetchKboAsmxSchedule(year, m);
      const parsed = extractGamesFromAsmxData(data, year, m);
      console.log(`  [parse] ${year}-${m}: ${parsed.length} games extracted`);
      allGames = allGames.concat(parsed);
    } catch (e) {
      console.warn(`  asmx ${year}-${m} 실패:`, e.message);
    }
  }

  // 응답에서 어제/오늘 필터링
  const stripGameDate = (g) => {
    const { gameDate, ...rest } = g;
    return rest;
  };
  const yesterdayGames = allGames
    .filter((g) => g.gameDate === yesterdayStr)
    .map(stripGameDate);
  const todayGames = allGames
    .filter((g) => g.gameDate === todayStr)
    .map(stripGameDate);

  console.log(
    `OK games: yesterday ${yesterdayGames.length}, today ${todayGames.length} (parsed total ${allGames.length})`
  );

  return {
    today: { date: todayStr, games: todayGames },
    yesterday: { date: yesterdayStr, games: yesterdayGames },
  };
}

async function writeJson(name, data) {
  const path = new URL(`${name}.json`, DATA_DIR);
  await writeFile(path, JSON.stringify(data, null, 2), "utf8");
  console.log(`  saved data/${name}.json`);
}

async function runSection(name, fn) {
  try {
    const data = await fn();
    await writeJson(name, data);
    return { ok: true };
  } catch (e) {
    console.error(`FAIL ${name}:`, e.message);
    return { ok: false, error: e.message };
  }
}

async function main() {
  console.log("KBO scraper v5.7 start");
  console.log(`${new Date().toISOString()}\n`);
  await mkdir(DATA_DIR, { recursive: true });
  const results = {
    standings: await runSection("standings", scrapeStandings),
    batters: await runSection("batters", scrapeBatters),
    pitchers: await runSection("pitchers", scrapePitchers),
    games: await runSection("games", scrapeGames),
  };
  const success = Object.values(results).filter((r) => r.ok).length;
  const errors = Object.entries(results).filter(([, r]) => !r.ok).map(([k, r]) => `${k}: ${r.error}`);
  const meta = {
    updatedAt: new Date().toISOString(),
    updatedAtKST: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
    season: new Date().getFullYear(),
    version: "5.7",
    success, total: 4, errors,
  };
  await writeJson("meta", meta);
  console.log(`\nDONE ${success}/4 success`);
  if (success === 0) {
    console.error("all failed - exit 1");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});