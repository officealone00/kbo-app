name: Scrape KBO Data

on:
  schedule:
    # 매일 아침 6시 + 밤 11시 (KST) 업데이트
    # UTC 기준 (KST = UTC + 9)
    # - UTC 21:00 = KST 06:00 (아침: 전날 경기 결과 반영)
    # - UTC 14:00 = KST 23:00 (밤: 당일 경기 종료 후)
    # KBO 사이트 새벽 점검 시간(02:00~05:00 KST) 회피
    - cron: '0 21 * * *'
    - cron: '0 14 * * *'
  workflow_dispatch:  # 수동 실행 버튼
  push:
    paths:
      - 'scraper/**'
      - '.github/workflows/scrape-kbo.yml'

jobs:
  scrape:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: scraper/package-lock.json

      - name: Install deps
        working-directory: scraper
        run: npm ci || npm install

      - name: Run scraper
        working-directory: scraper
        run: npm start

      - name: Commit updated data
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add data/
          # 변경사항 있을 때만 커밋
          if git diff --cached --quiet; then
            echo "데이터 변경 없음"
          else
            TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M UTC")
            git commit -m "chore(data): KBO 데이터 갱신 ${TIMESTAMP}"
            git push
          fi