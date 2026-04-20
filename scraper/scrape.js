/**
 * KBO 리그 스크래퍼 (v5.3)
 * v5.2 → v5.3: 어제 경기 복원 (games.json 구조 {today, yesterday}) + KST 타임존 정확 처리
 */

import { writeFile, mkdir } from "node:fs/promises";
import { load } from "cheerio";
import iconv from "iconv-lite";

const DATA_DIR = new URL("../data/", import.meta.url);
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const RETRY = 3;
const RETRY_DELAY_MS = 2000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchHtml(url, attempt = 1) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
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
      return fetchHtml(url, attempt + 1);
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

// KST 기준 YYYYMMDD (서버/로컬 무관)
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
      games: get(tds, "G", int),
      wins, losses, w: wins, l: losses, sv: saves, hld: holds,
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
  const [era, wins, so, saves] = await Promise.all([
    fetchPitcherPage(""),
    fetchPitcherPage("W_CN"),
    fetchPitcherPage("KK_CN"),
    fetchPitcherPage("SV_CN"),
  ]);
  console.log(`OK pitchers: era ${era.length}, w ${wins.length}, so ${so.length}, sv ${saves.length}`);
  return { era, wins, so, saves };
}

async function scrapeGamesForDate(dateStr) {
  const url = `https://www.koreabaseball.com/Schedule/ScoreBoard.aspx?searchScDate=${dateStr}`;
  const html = await fetchHtml(url);
  const $ = load(html);
  const games = [];
  $("table").each((_, t) => {
    const $t = $(t);
    const headers = getHeaderCells($, $t).map((_, th) => clean($(th).text())).get();
    if (headers[0] !== "TEAM") return;
    if (!["R", "H", "E"].every((k) => headers.includes(k))) return;
    const rows = getDataRows($, $t);
    if (rows.length < 2) return;
    const parseRow = ($row) => {
      const tds = $row.find("td").map((_, td) => clean($(td).text())).get();
      const team = tds[0] || "";
      const rIdx = headers.indexOf("R");
      const R = tds[rIdx];
      const score = R === "" || R === "-" || R === undefined ? null : parseInt(R, 10);
      return { team, score: Number.isFinite(score) ? score : null };
    };
    const away = parseRow($(rows[0]));
    const home = parseRow($(rows[1]));
    if (!away.team || !home.team) return;
    if (away.team === "TEAM" || home.team === "TEAM") return;
    const bothScored = away.score !== null && home.score !== null;
    games.push({
      away: away.team, home: home.team,
      awayScore: away.score, homeScore: home.score,
      status: bothScored ? "종료" : "예정",
    });
  });
  return { date: dateStr, games };
}

async function scrapeGames() {
  const todayStr = kstDateStr(0);
  const yesterdayStr = kstDateStr(-1);
  const [todayData, yesterdayData] = await Promise.all([
    scrapeGamesForDate(todayStr),
    scrapeGamesForDate(yesterdayStr),
  ]);
  console.log(`OK games: today ${todayData.date} (${todayData.games.length}), yesterday ${yesterdayData.date} (${yesterdayData.games.length})`);
  return { today: todayData, yesterday: yesterdayData };
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
  console.log("KBO scraper v5.3 start");
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
    version: "5.3",
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