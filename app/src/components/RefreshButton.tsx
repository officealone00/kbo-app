import { RefreshCw } from 'lucide-react';

// 공용 새로고침 버튼: 누르면 강제 최신 데이터 재요청(10분 캐시 우회).
// StandingsPage의 기존 새로고침 버튼과 동일한 스타일.
export default function RefreshButton({
  refreshing,
  onClick,
}: {
  refreshing: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={refreshing}
      className="p-2 rounded-full hover:bg-toss-gray-100"
      aria-label="새로고침"
    >
      <RefreshCw
        size={18}
        className={`text-toss-gray-600 ${refreshing ? 'animate-spin' : ''}`}
      />
    </button>
  );
}
