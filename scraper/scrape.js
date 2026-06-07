/**
 * KBO 리그 스크래퍼 (v5.9)
 * v5.8 → v5.9: 0-0 시작 전 상태 처리 버그 fix
 *   - play 셀에서 lose/win 클래스가 하나라도 있을 때만 "종료"
 *   - same/same(0-0) 또는 클래스 없음 = "예정" 처리 + 점수 null
 *   - 시간(time) 셀이 있어도 score 클래스 없으면 경기 시작 전
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
// KBO 이닝 표기 파서: "39 1/3" → 39.33, "39 2/3" → 39.67, "39" → 39, "1/3" → 0.33
// (기존 num()은 "39 1/3"을 3913으로 잘못 파싱했음)
const innings = (s) => {
  const t = clean(s);
  const m = t.match(/^(\d+)?\s*(?:([12])\/3)?$/);
  if (!m || (!m[1] && !m[2])) {
    const v = parseFloat(t.replace(/[^\d.]/g, ""));
    return Number.isFinite(v) ? v : 0;
  }
  const whole = m[1] ? parseInt(m[1], 10) : 0;
  const frac = m[2] ? parseInt(m[2], 10) / 3 : 0;
  return Math.round((whole + frac) * 100) / 100;
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
      ip: get(tds, "IP", innings),
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
  // 홀드(HOLD) 순위: 전용 정렬 페이지에서 수집. 실패해도 투수 섹션 전체는 살림.
  let hld = [];
  try {
    hld = await fetchPitcherPage("HOLD_CN");
    if (hld.length === 0) throw new Error("hold page empty");
  } catch (e) {
    // 폴백: 이미 받은 데이터에서 hld>0 선수를 모아 홀드 내림차순 정렬
    console.warn(`  holds 전용 페이지 실패(${e.message}) → 기존 데이터에서 hld 정렬로 폴백`);
    const seen = new Map();
    for (const p of [...era, ...w, ...so, ...sv]) {
      const k = `${p.name}|${p.team}`;
      if (!seen.has(k)) seen.set(k, p);
    }
    hld = [...seen.values()]
      .filter((p) => (p.hld || 0) > 0)
      .sort((a, b) => (b.hld || 0) - (a.hld || 0))
      .slice(0, 30)
      .map((p, i) => ({ ...p, rank: i + 1 }));
  }
  console.log(
    `OK pitchers: era ${era.length}, w ${w.length}, so ${so.length}, sv ${sv.length}, hld ${hld.length}`
  );
  return { era, w, so, sv, hld };
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

// 응답 데이터에서 게임 추출
// 응답 구조 (v5.7 디버그 로그로 확인):
//   { rows: [ { row: [ {Text, Class}, ... ] } ] }
// 각 row가 한 경기. cell은 Class로 의미 구분:
//   day  → "05.01(금)" 형식 날짜 (RowSpan으로 그날 경기 수만큼 묶임)
//   time → "<b>17:00</b>"
//   play → "<span>NC</span><em><span class='lose'>1</span><span>vs</span><span class='win'>2</span></em><span>두산</span>"
//   기타: relay/highlight/tv/radio/stadium/note
function extractGamesFromAsmxData(data, year, month) {
  const games = [];
  if (!data || !Array.isArray(data.rows)) {
    console.log(`  [parse] no rows array`);
    return games;
  }

  let currentDay = null; // RowSpan 처리: day 셀이 없는 row는 직전 day 값을 그대로 사용

  for (const r of data.rows) {
    const cells = r.row || [];
    if (!Array.isArray(cells) || cells.length === 0) continue;

    // Class별로 셀 인덱싱 (동일 Class 중복 시 첫 번째 사용)
    const cellByClass = {};
    for (const c of cells) {
      const cls = (c && c.Class) || "";
      if (cls && !cellByClass[cls]) cellByClass[cls] = c;
    }

    // day 셀이 있으면 currentDay 갱신
    if (cellByClass.day) {
      const dayText = clean(cellByClass.day.Text || "");
      const m = dayText.match(/(\d{1,2})\.(\d{1,2})/);
      if (m) currentDay = parseInt(m[2], 10);
    }
    if (!currentDay) continue;

    // play 셀이 있어야 경기 row
    const playCell = cellByClass.play;
    if (!playCell || !playCell.Text) continue;

    const playHtml = playCell.Text;

    // cheerio로 play HTML 파싱
    let away = null;
    let home = null;
    let awayScore = null;
    let homeScore = null;
    let status = "예정";

    try {
      const $ = load(`<div id="play">${playHtml}</div>`);
      const $play = $("#play");

      // 모든 span 텍스트 수집 (팀명과 점수가 span에 들어있음)
      const spans = $play.find("span").map((_, el) => ({
        text: clean($(el).text()),
        cls: $(el).attr("class") || "",
      })).get();

      // 팀명 추출: KBO 팀명에 매치되는 span 찾기 (보통 2개)
      const teamSpans = spans.filter((s) => KBO_TEAMS.has(s.text));
      if (teamSpans.length >= 2) {
        away = teamSpans[0].text;
        home = teamSpans[1].text;
      }

      // 점수 추출: lose/win/same 클래스의 span에서
      // - lose/win 클래스가 하나라도 있으면 → 경기 결과 결정됨 (종료)
      // - same/same(0-0)만 있으면 → 경기 시작 전/직전 placeholder ("예정"으로 처리)
      const scoreSpans = spans.filter(
        (s) => /(?:^|\s)(lose|win|same)(?:\s|$)/.test(s.cls) && /^\d+$/.test(s.text)
      );
      const hasResultClass = spans.some((s) =>
        /(?:^|\s)(lose|win)(?:\s|$)/.test(s.cls)
      );
      if (scoreSpans.length === 2 && hasResultClass) {
        awayScore = parseInt(scoreSpans[0].text, 10);
        homeScore = parseInt(scoreSpans[1].text, 10);
        if (Number.isFinite(awayScore) && Number.isFinite(homeScore)) {
          status = "종료";
        }
      }
      // hasResultClass 가 false면 score null + status "예정" 유지

      // 취소/연기 등 특수 상태 (play 셀 텍스트 전체에서 확인)
      const fullText = clean($play.text());
      if (/취소|연기|우천/.test(fullText)) {
        status = "취소";
        awayScore = null;
        homeScore = null;
      }
    } catch (e) {
      console.warn(`  [parse] play HTML parse error:`, e.message);
      continue;
    }

    if (!away || !home) continue;

    const gameDate = `${year}${String(month).padStart(2, "0")}${String(currentDay).padStart(2, "0")}`;

    // 시간 정보 (있으면 추가)
    let gameTime = null;
    if (cellByClass.time) {
      const tHtml = cellByClass.time.Text || "";
      const tClean = tHtml.replace(/<[^>]+>/g, "");
      const tMatch = tClean.match(/(\d{1,2}:\d{2})/);
      if (tMatch) gameTime = tMatch[1];
    }

    // 구장 (있으면 추가)
    let stadium = null;
    if (cellByClass.stadium) {
      stadium = clean((cellByClass.stadium.Text || "").replace(/<[^>]+>/g, ""));
    }

    games.push({
      gameDate,
      away,
      home,
      awayScore,
      homeScore,
      status,
      ...(gameTime ? { time: gameTime } : {}),
      ...(stadium ? { stadium } : {}),
    });
  }

  return games;
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
      console.log(`  ${year}-${m}: ${parsed.length} games parsed`);
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
  console.log("KBO scraper v5.9 start");
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
    version: "5.9",
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