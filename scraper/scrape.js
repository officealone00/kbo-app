/**
 * KBO 리그 스크래퍼 (v3 - EUC-KR 인코딩 대응)
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
import iconv from "iconv-lite";

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

  // KBO 공식 사이트는 EUC-KR 인코딩
  const contentType = res.headers.get("content-type") || "";
  const buffer = await res.arrayBuffer();
  const isEucKr =
    /euc-kr/i.test(contentType) ||
    (!/utf-?8/i.test(contentType) && url.includes("koreabaseball.com"));

  if (isEucKr) {
    return iconv.decode(Buffer.from(buffer), "euc-kr");
  }
  return Buffer.from(buffer).toString("utf-8");
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

  const rows = $("#cphContents_cphContents_cphContents_udpRecord table tbody tr");
  const teams = [];

  rows.each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 11) return;
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

  if (teams.length === 0) throw new Error("Standings 테이블이 비었어요");
  console.log(`✅ standings: ${teams.length}개 팀`);
  return teams;
}

// ─── 2. 타자 순위 ──────────────────────────────────
async function scrapeHitterCategory(sort) {
  const url = `https://www.koreabaseball.com/Record/Player/HitterBasic/Basic1.aspx?sort=${sort}`;
  const html = await fetchHtml(url);
  const $ = load(html);
  const rows = $("#cphContents_cphContents_cphContents_udpContent table tbody tr");
  const out = [];
  rows.each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 15) return;
    const rank = int($(tds[0]).text());
    if (rank === 0 || rank > 30) return;
    const name = clean($(tds[1]).text());
    const team = clean($(tds[2]).text());
    if (!name || !team) return;
    out.push({
      rank,
      name,
      team,
      avg: num($(tds[3]).text()),
      games: int($(tds[4]).text()),
      pa: int($(tds[5]).text()),
      ab: int($(tds[6]).text()),
      runs: int($(tds[7]).text()),
      hits: int($(tds[8]).text()),
      doubles: int($(tds[9]).text()),
      triples: int($(tds[10]).text()),
      hr: int($(tds[11]).text()),
      rbi: int($(tds[12]).text()),
      sb: int($(tds[13]).text()),
      bb: int($(tds[14]).text()),
    });
  });
  return out;
}

async function scrapeBatters() {
  const [avg, hr, rbi, sb] = await Promise.all([
    scrapeHitterCategory("HRA_RT"),
    scrapeHitterCategory("HR"),
    scrapeHitterCategory("RBI"),
    scrapeHitterCategory("SB"),
  ]);
  const merged = { avg, hr, rbi, sb };
  console.log(
    `✅ batters: avg ${avg.length}, hr ${hr.length}, rbi ${rbi.length}, sb ${sb.length}`
  );
  const basic2 = await scrapeHitterBasic2();
  if (basic2) merged.basic2 = basic2;
  return merged;
}

async function scrapeHitterBasic2() {
  try {
    const url =
      "https://www.koreabaseball.com/Record/Player/HitterBasic/Basic2.aspx";
    const html = await fetchHtml(url);
    const $ = load(html);
    const rows = $("#cphContents_cphContents_cphContents_udpContent table tbody tr");
    const out = [];
    rows.each((_, tr) => {
      const tds = $(tr).find("td");
      if (tds.length < 13) return;
      const rank = int($(tds[0]).text());
      if (rank === 0 || rank > 30) return;
      const name = clean($(tds[1]).text());
      const team = clean($(tds[2]).text());
      if (!name || !team) return;
      out.push({
        rank,
        name,
        team,
        gd: int($(tds[3]).text()),
        sacFly: int($(tds[4]).text()),
        sacBunt: int($(tds[5]).text()),
        ibb: int($(tds[6]).text()),
        hbp: int($(tds[7]).text()),
        so: int($(tds[8]).text()),
        gdp: int($(tds[9]).text()),
        slg: num($(tds[10]).text()),
        obp: num($(tds[11]).text()),
        ops: num($(tds[12]).text()),
      });
    });
    return out;
  } catch {
    return null;
  }
}

// ─── 3. 투수 순위 ──────────────────────────────────
async function scrapePitcherCategory(sort) {
  const url = `https://www.koreabaseball.com/Record/Player/PitcherBasic/Basic1.aspx?sort=${sort}`;
  const html = await fetchHtml(url);
  const $ = load(html);
  const rows = $("#cphContents_cphContents_cphContents_udpContent table tbody tr");
  const out = [];
  rows.each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 22) return;
    const rank = int($(tds[0]).text());
    if (rank === 0 || rank > 30) return;
    const name = clean($(tds[1]).text());
    const team = clean($(tds[2]).text());
    if (!name || !team) return;
    const wins = int($(tds[5]).text());
    const losses = int($(tds[6]).text());
    const holds = int($(tds[11]).text());
    const saves = int($(tds[10]).text());
    const cg = int($(tds[7]).text());
    const sho = int($(tds[8]).text());
    let role = "선발";
    if (saves > 3) role = "마무리";
    else if (holds > 5) role = "불펜";
    else if (wins + losses < 3 && cg + sho === 0) role = "불펜";
    out.push({
      rank,
      name,
      team,
      role,
      era: num($(tds[3]).text()),
      games: int($(tds[4]).text()),
      wins,
      losses,
      cg,
      sho,
      w: wins,
      l: losses,
      sv: saves,
      hld: holds,
      wpct: num($(tds[12]).text()),
      bf: int($(tds[13]).text()),
      ip: num($(tds[15]).text()),
      h: int($(tds[16]).text()),
      hr: int($(tds[17]).text()),
      bb: int($(tds[18]).text()),
      hbp: int($(tds[19]).text()),
      so: int($(tds[20]).text()),
      er: int($(tds[21]).text()),
    });
  });
  return out;
}

async function scrapePitchers() {
  const [era, wins, so, saves] = await Promise.all([
    scrapePitcherCategory("ERA"),
    scrapePitcherCategory("W"),
    scrapePitcherCategory("SO"),
    scrapePitcherCategory("SV"),
  ]);
  console.log(
    `✅ pitchers: era ${era.length}, w ${wins.length}, so ${so.length}, sv ${saves.length}`
  );
  return { era, wins, so, saves };
}

// ─── 4. 오늘/어제 경기 결과 (NEW 파싱) ──────────────────────
const KBO_TEAMS = [
  "KIA",
  "삼성",
  "LG",
  "KT",
  "두산",
  "SSG",
  "롯데",
  "한화",
  "NC",
  "키움",
];

/**
 * KBO 공식 Schedule.aspx 페이지 HTML 파싱
 * 테이블 row 구조: <tr><td>시간</td><td>팀A vs 팀B</td><td>스코어</td>...
 */
function parseKBOScheduleHTML(html, dateStr) {
  const $ = load(html);
  const games = [];

  // Schedule.aspx의 .tbl-type06 테이블
  $(".tbl-type06 tbody tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 4) return;

    // 시간 (첫번째 열)
    const time = clean($(tds[0]).text());

    // 팀 vs 팀 (play 열)
    const playTd = $(tr).find("td.play").first();
    const homeName = clean(playTd.find(".team.home em").text() || "");
    const awayName = clean(playTd.find(".team.away em").text() || "");

    // 스코어 (score 열)
    const scoreText = clean(playTd.find(".score em").text() || "");
    let homeScore = null;
    let awayScore = null;
    const scoreMatch = scoreText.match(/(\d+)\s*:\s*(\d+)/);
    if (scoreMatch) {
      // KBO 페이지에서는 "AWAY vs HOME" 순서로 표시되고 스코어도 Away:Home
      awayScore = parseInt(scoreMatch[1], 10);
      homeScore = parseInt(scoreMatch[2], 10);
    }

    // 구장
    const stadium = clean(
      $(tds[tds.length - 2]).text() || $(tds[tds.length - 1]).text() || ""
    );

    // 상태
    let status = "예정";
    if (homeScore !== null && awayScore !== null) status = "종료";
    if (clean($(tr).text()).includes("취소")) status = "취소";

    if (homeName && awayName) {
      games.push({
        home: homeName,
        away: awayName,
        homeScore,
        awayScore,
        status,
        time,
        stadium,
      });
    }
  });

  return games;
}

/**
 * Fallback: 텍스트 전체에서 팀 이름 쌍 찾아서 파싱
 * 예: "KIA 3 경기종료 6 롯데"
 */
function parseGamesFromText(html, dateStr) {
  const text = clean(load(html)("body").text());
  const games = [];
  const teamPattern = KBO_TEAMS.join("|");
  const regex = new RegExp(
    `(${teamPattern})\\s+(\\d+)\\s+(?:경기종료|종료|VS|vs)\\s+(\\d+)\\s+(${teamPattern})`,
    "g"
  );

  let m;
  while ((m = regex.exec(text)) !== null) {
    games.push({
      away: m[1],
      awayScore: parseInt(m[2], 10),
      home: m[4],
      homeScore: parseInt(m[3], 10),
      status: "종료",
      time: "",
      stadium: "",
    });
  }

  return games;
}

async function scrapeGamesByDate(dateObj) {
  const dateStr =
    dateObj.getFullYear() +
    String(dateObj.getMonth() + 1).padStart(2, "0") +
    String(dateObj.getDate()).padStart(2, "0");

  const urls = [
    `https://www.koreabaseball.com/Schedule/Schedule.aspx?seriesId=0,9,6,7,8&searchScDate=${dateStr}`,
    `https://www.koreabaseball.com/Schedule/ScoreBoard.aspx?searchScDate=${dateStr}`,
  ];

  for (const url of urls) {
    try {
      const html = await fetchHtml(url);

      // 1차 시도: 구조화된 HTML 파싱
      let games = parseKBOScheduleHTML(html, dateStr);

      // 2차 시도: 텍스트에서 패턴 매칭
      if (games.length === 0) {
        games = parseGamesFromText(html, dateStr);
      }

      // 중복 제거 (같은 팀 페어)
      const seen = new Set();
      const unique = [];
      for (const g of games) {
        const key = `${g.home}-${g.away}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(g);
      }

      if (unique.length > 0) {
        return { date: dateStr, games: unique };
      }
    } catch (e) {
      console.warn(`  ⚠️  ${url} 실패: ${e.message}`);
    }
  }

  return { date: dateStr, games: [] };
}

async function scrapeGames() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const [todayData, yesterdayData] = await Promise.all([
    scrapeGamesByDate(today),
    scrapeGamesByDate(yesterday),
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

  console.log(
    `\n${meta.success === 4 ? "✅" : "⚠️"} 완료: ${meta.success}/${meta.total} 성공`
  );
  if (errors.length && meta.success === 0) {
    console.error("에러:", errors);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("치명적 에러:", e);
  process.exit(1);
});