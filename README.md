# ⚾ KBO 순위 앱

KBO 리그 팀 순위, 타자/투수 Top 30, 오늘/어제 경기 결과를 보여주는 **앱인토스 미니앱**.

데이터는 GitHub Actions가 매시간 KBO 공식 사이트에서 크롤링 → `data/*.json`으로 커밋 → jsdelivr CDN으로 앱에 전달.

---

## 📂 프로젝트 구조

```
kbo-app/
├── .github/workflows/
│   └── scrape-kbo.yml        # 매시간 자동 크롤링
├── scraper/
│   ├── scrape.js             # KBO.com 크롤러 (Node + cheerio)
│   └── package.json
├── data/                     # 자동 생성/커밋되는 JSON (수동 수정 X)
│   ├── standings.json        # 팀 순위
│   ├── batters.json          # 타자 Top 30 (avg/hr/rbi/sb)
│   ├── pitchers.json         # 투수 Top 30 (era/w/so/sv)
│   ├── games.json            # 오늘/어제 경기
│   └── meta.json             # 마지막 업데이트 시각
├── app/                      # 앱인토스 미니앱 (Vite + React)
│   ├── src/
│   │   ├── components/       # BannerAd, BottomNav, TeamBadge 등
│   │   ├── pages/            # 4개 탭 페이지
│   │   ├── data/teams.ts     # 10개 팀 메타 (색상, 이모지)
│   │   ├── utils/            # api, storage
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── granite.config.ts
│   └── package.json
└── README.md
```

## 🚀 배포 가이드 (처음 1회)

### 1. GitHub Repo 생성
```bash
# 이 폴더를 GitHub에 올리기
cd kbo-app
git init
git add .
git commit -m "초기 커밋"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/kbo-app.git
git push -u origin main
```

### 2. GitHub Actions 권한 확인
Repo 설정에서:
1. `Settings` → `Actions` → `General`
2. **Workflow permissions**: **Read and write permissions** 선택
3. **Allow GitHub Actions to create and approve pull requests** 체크

### 3. 스크래퍼 첫 실행
1. Repo의 **Actions** 탭
2. `Scrape KBO Data` workflow 선택
3. **Run workflow** 버튼 클릭 (수동 첫 실행)
4. `data/*.json` 파일들이 업데이트되는지 확인

이후엔 매시간 자동으로 크롤링됨.

### 4. 앱에 GitHub 정보 입력
`app/src/utils/api.ts` 파일 열고 상단 CONFIG 수정:
```ts
const CONFIG = {
  githubUser: 'YOUR_GITHUB_USERNAME',  // ← 본인 GitHub 아이디
  repo: 'kbo-app',
  branch: 'main',
};
```

### 5. 앱인토스 광고 ID 입력
앱인토스 콘솔에서 발급받은 실제 광고 ID로 교체:

**`app/src/components/BannerAd.tsx`**
```ts
const IS_AD_PRODUCTION = true;  // 출시 전 true
const PROD_BANNER_ID = 'ait.v2.live.여기에_실제_배너ID';
```

**`app/src/components/InterstitialAd.tsx`**
```ts
const IS_AD_PRODUCTION = true;
const PROD_INTERSTITIAL_ID = 'ait.v2.live.여기에_실제_전면ID';
```

### 6. 앱 로컬 실행 (개발)
```bash
cd app
npm install
npm run dev
```
브라우저에서 `http://localhost:5173` 접속.

### 7. 앱인토스 배포
```bash
cd app
npm run build   # ait build → .ait 파일 생성
```
생성된 `.ait` 파일을 앱인토스 콘솔에 업로드 → 심사 → 출시.

---

## 🔄 데이터 흐름

```
매시간 정각 (UTC)
  ↓
GitHub Actions 트리거
  ↓
scraper/scrape.js 실행 → KBO.com 크롤링
  ↓
data/*.json 업데이트 → git commit/push
  ↓
jsdelivr CDN 캐시 갱신 (~10분)
  ↓
앱이 fetch → 최신 데이터 표시
```

## 📊 데이터 소스

- **팀 순위**: https://www.koreabaseball.com/Record/TeamRank/TeamRankDaily.aspx
- **타자 기록**: https://www.koreabaseball.com/Record/Player/HitterBasic/Basic1.aspx
- **투수 기록**: https://www.koreabaseball.com/Record/Player/PitcherBasic/Basic1.aspx
- **경기 결과**: https://www.koreabaseball.com/Schedule/ScoreBoard.aspx

## 🎨 기능

| 탭 | 내용 |
|----|------|
| 🏆 순위 | 10팀 순위 + 즐겨찾는 팀 하이라이트 카드 |
| 🏏 타자 | Top 30 (타율/홈런/타점/도루) + 팀 필터 |
| ⚾ 투수 | Top 30 (방어율/승/삼진/세이브) + 선발/불펜/마무리 필터 + 팀 필터 |
| 📅 경기 | 오늘/어제 경기 결과 + 내 팀 경기 상단 정렬 |

## 💰 수익화

- **배너 광고**: 각 페이지 중간 (10위 아래) + 하단
- **전면 광고**: 탭 8회 이동마다 1회 표시

## 🐛 트러블슈팅

### GitHub Actions가 실패할 때
- Actions 로그 확인
- KBO.com HTML 구조 변경 가능성 → `scraper/scrape.js` 선택자 조정
- 403 에러 시 User-Agent 변경

### 앱에서 데이터가 안 불러와질 때
1. `api.ts`의 `CONFIG.githubUser`가 본인 아이디인지 확인
2. Repo가 **public**인지 확인 (jsdelivr는 private repo 지원 안 함)
3. `data/*.json`이 main 브랜치에 있는지 확인
4. 브라우저 Network 탭에서 jsdelivr URL 직접 호출 테스트

### 광고가 안 나올 때
- 개발 환경 (`IS_AD_PRODUCTION = false`) 에서는 테스트 광고 ID 사용
- 앱인토스 웹뷰에서만 실제 광고 작동
- 로컬 개발 시에는 광고 영역이 비어있는 게 정상

## 📝 라이선스

개인 학습/포트폴리오 용도. KBO 공식 데이터 사용 시 저작권 유의.
