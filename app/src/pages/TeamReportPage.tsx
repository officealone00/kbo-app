import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
  Target,
  Users,
  Swords,
  ClipboardCheck,
  Activity,
  Flame,
} from 'lucide-react';
import { api } from '@/utils/api';
import { getFavoriteTeam } from '@/utils/storage';
import { getTeam } from '@/data/teams';
import { generateTeamReport, type TeamReport } from '@/utils/teamAnalytics';
import RewardedAd from '@/components/RewardedAd';
import BannerAd from '@/components/BannerAd';

export default function TeamReportPage() {
  const navigate = useNavigate();
  const favorite = getFavoriteTeam();
  const [report, setReport] = useState<TeamReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [adShown, setAdShown] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const unlockedRef = useRef(false); // 비동기 타이밍 이슈 방지

  // 응원팀 없으면 홈으로
  useEffect(() => {
    if (!favorite) {
      navigate('/', { replace: true });
    }
  }, [favorite, navigate]);

  // 데이터 로드 + 리포트 생성
  useEffect(() => {
    if (!favorite) return;
    (async () => {
      try {
        const [standings, batters, pitchers, games] = await Promise.all([
          api.standings(),
          api.batters().catch(() => null),
          api.pitchers().catch(() => null),
          api.games().catch(() => null),
        ]);
        const r = generateTeamReport(favorite, standings, batters, pitchers, games);
        setReport(r);
      } catch (e) {
        console.warn('[TeamReport] load error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [favorite]);

  const handleReward = () => {
    unlockedRef.current = true;
    setUnlocked(true);
  };

  const handleAdClose = () => {
    setAdShown(false);
    // 보상 못 받은 경우에만 홈으로 리턴
    if (!unlockedRef.current) {
      navigate('/', { replace: true });
    }
  };

  if (!favorite) return null;

  const info = getTeam(favorite);

  return (
    <div className="min-h-screen bg-toss-gray-50">
      {/* Header */}
      <div className="px-5 pt-14 pb-4 bg-white flex items-center gap-2">
        <button
          onClick={() => navigate('/', { replace: true })}
          className="p-1 -ml-1 rounded-full hover:bg-toss-gray-100"
          aria-label="뒤로"
        >
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 className="toss-title text-[22px]">📊 스카우팅 리포트</h1>
          <p className="toss-caption mt-0.5">{info.fullName} · 야구 분석 전문가 코멘트</p>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="px-5 py-6 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {/* 광고 시청 전 잠금 화면 */}
      {!loading && !unlocked && !adShown && (
        <div className="px-5 py-6">
          <div
            className="rounded-2xl p-6 text-white relative overflow-hidden"
            style={{ backgroundColor: info.color }}
          >
            <div
              className="absolute -right-6 -top-6 opacity-20"
              style={{ fontSize: 120 }}
            >
              {info.emoji}
            </div>
            <div className="relative">
              <p className="text-xs font-semibold opacity-80 mb-1">✨ 프리미엄 스카우팅 리포트</p>
              <p className="text-2xl font-bold mb-2">{info.fullName}</p>
              <p className="text-sm opacity-90 leading-relaxed">
                팀 폼 · 타선 색깔 · 마운드 진단 ·<br />
                매직넘버 · 강점/약점 진단까지
              </p>
            </div>
          </div>

          {/* 리포트 미리보기 (흐림) */}
          <div className="mt-4 relative">
            <div className="space-y-3 filter blur-md pointer-events-none select-none">
              <MockCard icon="🔍" title="스카우팅 진단" />
              <MockCard icon="🔥" title="팀 폼 분석" />
              <MockCard icon="💥" title="타선 색깔 진단" />
              <MockCard icon="🎯" title="마운드 진단" />
            </div>

            {/* 중앙 CTA 버튼 */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="bg-white rounded-2xl shadow-xl px-6 py-5 text-center max-w-[280px]">
                <p className="text-4xl mb-2">🎬</p>
                <p className="font-bold text-toss-gray-900 mb-1">
                  광고 시청 후 리포트 열람
                </p>
                <p className="text-xs text-toss-gray-600 mb-4 leading-relaxed">
                  짧은 광고 시청하고<br />
                  전문가급 분석을 확인해보세요
                </p>
                <button
                  onClick={() => setAdShown(true)}
                  className="w-full py-3 rounded-xl font-bold text-white text-sm shadow-lg"
                  style={{ backgroundColor: info.color }}
                >
                  📊 리포트 보기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 리워드 광고 실행 */}
      {adShown && (
        <RewardedAd onReward={handleReward} onClose={handleAdClose} />
      )}

      {/* 리포트 본문 (광고 시청 완료 후) */}
      {!loading && unlocked && report && (
        <div className="px-5 py-6 pb-10 space-y-4">
          {/* 헤드라인 인사이트 */}
          <div
            className="rounded-2xl p-5 text-white"
            style={{ backgroundColor: info.color }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold opacity-80">💡 헤드라인</span>
            </div>
            <p className="text-base font-bold leading-relaxed">{report.insight}</p>
          </div>

          {/* 0. 스카우팅 진단 (강점/약점/과제) */}
          <Card icon={<ClipboardCheck size={18} />} title="스카우팅 진단" color={info.color}>
            <div className="space-y-2.5">
              <DiagnosisRow
                tag="강점"
                tagColor="#19B377"
                tagBg="#E8F8F0"
                text={report.diagnosis.strength}
              />
              <DiagnosisRow
                tag="약점"
                tagColor="#FF3B30"
                tagBg="#FFF0EE"
                text={report.diagnosis.weakness}
              />
              <DiagnosisRow
                tag="과제"
                tagColor="#3182F6"
                tagBg="#E7F1FF"
                text={report.diagnosis.agenda}
              />
            </div>
          </Card>

          {/* 1. 팀 폼 */}
          <Card icon={<Trophy size={18} />} title="팀 폼 분석" color={info.color}>
            <div className="space-y-3">
              <TrendRow form={report.form} />

              {/* 모멘텀 바 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-toss-gray-600">모멘텀</span>
                  <span className="text-xs font-bold" style={{ color: info.color }}>
                    {report.form.momentum}점 · {report.form.momentumLabel}
                  </span>
                </div>
                <div className="h-2 bg-toss-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${report.form.momentum}%`,
                      backgroundColor: info.color,
                    }}
                  />
                </div>
              </div>

              {/* 홈/원정 */}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <StatBox
                  label="🏟️ 홈 승률"
                  value={`${(report.form.homeWinRate * 100).toFixed(0)}%`}
                  good={report.form.homeWinRate >= 0.5}
                />
                <StatBox
                  label="✈️ 원정 승률"
                  value={`${(report.form.awayWinRate * 100).toFixed(0)}%`}
                  good={report.form.awayWinRate >= 0.5}
                />
              </div>

              {/* 홈/원정 진단 한 줄 */}
              <div className="p-3 bg-toss-gray-50 rounded-xl">
                <p className="text-xs text-toss-gray-700 leading-relaxed">
                  📍 {report.form.homeAwayDiagnosis}
                </p>
              </div>

              <div className="p-3 bg-toss-gray-50 rounded-xl">
                <p className="text-xs text-toss-gray-600">
                  최근 10경기: <span className="font-bold text-toss-gray-900">{report.form.last10Record}</span>
                </p>
                <p className="text-xs text-toss-gray-600 mt-1">
                  현재:{' '}
                  <span
                    className="font-bold"
                    style={{ color: report.form.streakType === 'win' ? '#19B377' : '#FF3B30' }}
                  >
                    {report.form.streakCount}연{report.form.streakType === 'win' ? '승 🔥' : '패 😢'}
                  </span>
                </p>
              </div>
            </div>
          </Card>

          {/* 2. 타선 색깔 진단 */}
          {report.batting && (
            <Card icon={<Flame size={18} />} title="타선 색깔 진단" color={info.color}>
              <div className="space-y-3">
                <div
                  className="rounded-xl p-4 flex items-center gap-3"
                  style={{ backgroundColor: info.bgLight }}
                >
                  <span style={{ fontSize: 32 }}>{report.batting.identityIcon}</span>
                  <div>
                    <p className="text-[11px] font-semibold" style={{ color: info.color }}>
                      팀 타선 색깔
                    </p>
                    <p className="text-lg font-extrabold" style={{ color: info.color }}>
                      {report.batting.identityLabel}
                    </p>
                  </div>
                </div>

                {/* 4축 지표 */}
                <div className="grid grid-cols-2 gap-2">
                  <MetricBox
                    label="🎯 컨택 (상위 5인 평균 타율)"
                    value={report.batting.topAvg.toFixed(3)}
                    sub={report.batting.topAvg >= 0.31 ? '리그 최정상' : report.batting.topAvg >= 0.29 ? '리그 정상권' : '평이'}
                  />
                  <MetricBox
                    label="💥 장타 (상위 3인 홈런)"
                    value={`${report.batting.topHR}개`}
                    sub={report.batting.topHR >= 45 ? '리그 최정상' : report.batting.topHR >= 25 ? '리그 정상권' : '보강 필요'}
                  />
                  <MetricBox
                    label="🎯 타점 (상위 3인 합)"
                    value={`${report.batting.topRBI}점`}
                    sub="득점 생산력"
                  />
                  <MetricBox
                    label="💨 기동 (상위 3인 도루)"
                    value={`${report.batting.topSB}개`}
                    sub={report.batting.topSB >= 40 ? '리그 최정상' : report.batting.topSB >= 25 ? '리그 정상권' : '평이'}
                  />
                </div>

                <CoachComment text={report.batting.diagnosis} color={info.color} />
              </div>
            </Card>
          )}

          {/* 3. 마운드 진단 */}
          {report.pitching && (
            <Card icon={<Activity size={18} />} title="마운드 진단" color={info.color}>
              <div className="space-y-3">
                <div
                  className="rounded-xl p-4 flex items-center gap-3"
                  style={{ backgroundColor: info.bgLight }}
                >
                  <span style={{ fontSize: 32 }}>{report.pitching.identityIcon}</span>
                  <div>
                    <p className="text-[11px] font-semibold" style={{ color: info.color }}>
                      마운드 색깔
                    </p>
                    <p className="text-lg font-extrabold" style={{ color: info.color }}>
                      {report.pitching.identityLabel}
                    </p>
                  </div>
                </div>

                {/* 선발 ERA + 불펜 안정도 + 탈삼진 */}
                <div className="grid grid-cols-3 gap-2">
                  <MetricBox
                    label="🎯 선발 ERA"
                    value={report.pitching.starterERA > 0 ? report.pitching.starterERA.toFixed(2) : '-'}
                    sub={
                      report.pitching.starterERA > 0 && report.pitching.starterERA <= 3.0
                        ? '리그 최정상'
                        : report.pitching.starterERA <= 3.8
                        ? '리그 정상권'
                        : report.pitching.starterERA <= 4.5
                        ? '평이'
                        : '보강 필요'
                    }
                  />
                  <MetricBox
                    label="🔥 불펜 안정도"
                    value={`${report.pitching.bullpenStability}`}
                    sub={
                      report.pitching.bullpenStability >= 75
                        ? '안정'
                        : report.pitching.bullpenStability >= 55
                        ? '준수'
                        : report.pitching.bullpenStability >= 35
                        ? '변수'
                        : '보강 시급'
                    }
                  />
                  <MetricBox
                    label="⚡ 탈삼진 (상위3)"
                    value={`${report.pitching.topSO}K`}
                    sub={
                      report.pitching.topSO >= 350 ? '파워피칭' : report.pitching.topSO >= 220 ? '준수' : '평이'
                    }
                  />
                </div>

                {/* 불펜 안정도 시각화 바 */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-toss-gray-600">불펜 운영 안정도</span>
                    <span className="text-xs font-bold" style={{ color: info.color }}>
                      {report.pitching.bullpenStability}/100
                    </span>
                  </div>
                  <div className="h-2 bg-toss-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${report.pitching.bullpenStability}%`,
                        backgroundColor: info.color,
                      }}
                    />
                  </div>
                </div>

                <CoachComment text={report.pitching.diagnosis} color={info.color} />
              </div>
            </Card>
          )}

          {/* 4. 순위 전망 + 매직넘버 */}
          <Card icon={<Target size={18} />} title="순위 전망 · 매직넘버" color={info.color}>
            <div className="space-y-3">
              <div
                className="rounded-xl p-4 text-center"
                style={{ backgroundColor: info.bgLight }}
              >
                <p className="text-xs font-semibold" style={{ color: info.color }}>
                  현재 순위
                </p>
                <p className="text-4xl font-extrabold mt-1" style={{ color: info.color }}>
                  {report.outlook.currentRank}위
                </p>
                <p className="text-[11px] text-toss-gray-600 mt-1">
                  잔여 {report.outlook.gamesRemaining}경기
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <GapBox label="1위까지" gap={report.outlook.gapToTop1} />
                <GapBox label="4위까지" gap={report.outlook.gapToTop4} />
                <GapBox label="5위까지" gap={report.outlook.gapToPostseason} />
              </div>

              {/* 매직넘버 / 트래직넘버 */}
              {report.outlook.magicNumber !== null && (
                <div className="rounded-xl p-3 flex items-center gap-3" style={{ backgroundColor: '#E8F8F0' }}>
                  <span className="text-xl">🪄</span>
                  <div className="flex-1">
                    <p className="text-[11px] font-semibold text-[#19B377]">매직넘버 (포스트시즌 확정)</p>
                    <p className="text-xs text-toss-gray-700 mt-0.5">
                      잔여 {report.outlook.gamesRemaining}경기에서{' '}
                      <span className="font-extrabold text-[#19B377]">
                        {report.outlook.magicNumber}승
                      </span>
                      을 추가하면 5위 진입 확정
                    </p>
                  </div>
                </div>
              )}

              {report.outlook.tragicNumber !== null && (
                <div className="rounded-xl p-3 flex items-center gap-3" style={{ backgroundColor: '#FFF4E6' }}>
                  <span className="text-xl">⏳</span>
                  <div className="flex-1">
                    <p className="text-[11px] font-semibold text-[#FF9500]">추격 필요승수</p>
                    <p className="text-xs text-toss-gray-700 mt-0.5">
                      5위 추격을 위해 잔여 경기 중{' '}
                      <span className="font-extrabold text-[#FF9500]">
                        최소 {report.outlook.tragicNumber}승
                      </span>{' '}
                      필요
                    </p>
                  </div>
                </div>
              )}

              <div className="p-3 bg-toss-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-toss-gray-600">포스트시즌 진출</span>
                  <ProbabilityBadge prob={report.outlook.postseasonProbability} />
                </div>
                <p className="text-xs text-toss-gray-600">
                  예상 최종 순위:{' '}
                  <span className="font-bold text-toss-gray-900">
                    {report.outlook.projection}
                  </span>
                </p>
              </div>

              <CoachComment text={report.outlook.outlookComment} color={info.color} />
            </div>
          </Card>

          {/* 5. TOP 선수 */}
          <Card icon={<Users size={18} />} title="팀 내 TOP 선수" color={info.color}>
            <div className="grid grid-cols-2 gap-2">
              <PlayerBox
                label="🏏 타율 1위"
                player={report.topPlayers.topBatter}
                color={info.color}
              />
              <PlayerBox
                label="💥 홈런 1위"
                player={report.topPlayers.topHR}
                color={info.color}
              />
              <PlayerBox
                label="⚾ ERA 1위"
                player={report.topPlayers.topPitcher}
                color={info.color}
              />
              <PlayerBox
                label="🔥 삼진 1위"
                player={report.topPlayers.topSO}
                color={info.color}
              />
            </div>
          </Card>

          {/* 6. 최근 경기 */}
          {report.recentGames.length > 0 && (
            <Card icon={<Swords size={18} />} title="최근 경기" color={info.color}>
              <div className="space-y-2">
                {report.recentGames.map((g, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-xl"
                    style={{
                      backgroundColor:
                        g.result === 'win'
                          ? '#E8F8F0'
                          : g.result === 'lose'
                          ? '#FFF0EE'
                          : '#F2F4F6',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-toss-gray-500">
                        {g.date}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-toss-gray-600">
                        {g.isHome ? 'H' : 'A'}
                      </span>
                      <span className="text-sm font-bold text-toss-gray-900">
                        vs {g.opponent}
                      </span>
                    </div>
                    <div className="text-right">
                      {g.result !== 'pending' ? (
                        <>
                          <span className="text-sm font-extrabold tabular-nums">
                            {g.teamScore} : {g.opponentScore}
                          </span>
                          <span
                            className="ml-2 text-[11px] font-bold"
                            style={{
                              color:
                                g.result === 'win' ? '#19B377' : '#FF3B30',
                            }}
                          >
                            {g.result === 'win' ? '승' : '패'}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-toss-gray-500">예정</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* 하단 배너 */}
          <div className="pt-2">
            <BannerAd />
          </div>

          {/* 닫기 버튼 */}
          <button
            onClick={() => navigate('/', { replace: true })}
            className="w-full py-3.5 bg-white rounded-xl font-semibold text-sm text-toss-gray-700 mt-2"
          >
            ← 순위로 돌아가기
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 하위 컴포넌트들 ───────────────────────

function MockCard({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <div className="flex-1">
        <p className="font-bold text-toss-gray-900">{title}</p>
        <div className="h-3 bg-toss-gray-100 rounded mt-2 w-3/4" />
      </div>
    </div>
  );
}

function Card({
  icon,
  title,
  color,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-toss">
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {icon}
        </div>
        <h3 className="font-bold text-toss-gray-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function TrendRow({ form }: { form: { trend: 'up' | 'down' | 'steady'; trendLabel: string } }) {
  const Icon = form.trend === 'up' ? TrendingUp : form.trend === 'down' ? TrendingDown : Minus;
  const color = form.trend === 'up' ? '#19B377' : form.trend === 'down' ? '#FF3B30' : '#8B95A1';
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center"
        style={{ backgroundColor: `${color}20` }}
      >
        <Icon size={16} style={{ color }} />
      </div>
      <span className="font-bold text-toss-gray-900">{form.trendLabel}</span>
    </div>
  );
}

function StatBox({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="bg-toss-gray-50 rounded-xl p-3 text-center">
      <p className="text-[11px] text-toss-gray-600 mb-1">{label}</p>
      <p
        className="text-lg font-extrabold tabular-nums"
        style={{ color: good ? '#19B377' : '#FF9500' }}
      >
        {value}
      </p>
    </div>
  );
}

function MetricBox({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-toss-gray-50 rounded-xl p-3">
      <p className="text-[10px] text-toss-gray-600 leading-tight">{label}</p>
      <p className="text-lg font-extrabold tabular-nums text-toss-gray-900 mt-1">{value}</p>
      <p className="text-[10px] text-toss-gray-500 mt-0.5">{sub}</p>
    </div>
  );
}

function GapBox({ label, gap }: { label: string; gap: number }) {
  return (
    <div className="bg-toss-gray-50 rounded-xl p-2.5 text-center">
      <p className="text-[10px] text-toss-gray-600 mb-0.5">{label}</p>
      <p className="text-base font-extrabold text-toss-gray-900 tabular-nums">
        {gap === 0 ? '-' : `${gap}`}
      </p>
    </div>
  );
}

function ProbabilityBadge({ prob }: { prob: 'high' | 'medium' | 'low' }) {
  const config = {
    high: { label: '유력', color: '#19B377', bg: '#E8F8F0' },
    medium: { label: '가능', color: '#FF9500', bg: '#FFF4E6' },
    low: { label: '어려움', color: '#FF3B30', bg: '#FFF0EE' },
  }[prob];
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded"
      style={{ color: config.color, backgroundColor: config.bg }}
    >
      {config.label}
    </span>
  );
}

function PlayerBox({
  label,
  player,
  color,
}: {
  label: string;
  player: { name: string; stat: string; value: string } | null;
  color: string;
}) {
  if (!player) {
    return (
      <div className="bg-toss-gray-50 rounded-xl p-3 text-center">
        <p className="text-[11px] text-toss-gray-500 mb-1">{label}</p>
        <p className="text-sm text-toss-gray-400">-</p>
      </div>
    );
  }
  return (
    <div className="bg-toss-gray-50 rounded-xl p-3">
      <p className="text-[11px] text-toss-gray-600 mb-0.5">{label}</p>
      <p className="font-bold text-toss-gray-900 truncate">{player.name}</p>
      <p className="text-xs font-semibold mt-0.5 tabular-nums" style={{ color }}>
        {player.stat} {player.value}
      </p>
    </div>
  );
}

function DiagnosisRow({
  tag,
  tagColor,
  tagBg,
  text,
}: {
  tag: string;
  tagColor: string;
  tagBg: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className="flex-shrink-0 text-[10px] font-extrabold px-2 py-1 rounded-md"
        style={{ color: tagColor, backgroundColor: tagBg }}
      >
        {tag}
      </span>
      <p className="text-[13px] text-toss-gray-800 leading-relaxed flex-1 pt-0.5">
        {text}
      </p>
    </div>
  );
}

function CoachComment({ text, color }: { text: string; color: string }) {
  return (
    <div
      className="rounded-xl p-3 flex gap-2"
      style={{ borderLeft: `3px solid ${color}`, backgroundColor: '#FAFBFC' }}
    >
      <span className="text-[11px] flex-shrink-0" style={{ color }}>
        💬
      </span>
      <p className="text-[12px] text-toss-gray-700 leading-relaxed">{text}</p>
    </div>
  );
}
