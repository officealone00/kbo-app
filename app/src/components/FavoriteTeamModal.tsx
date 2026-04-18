import { useState } from 'react';
import { X, Heart } from 'lucide-react';
import { TEAMS, TEAM_NAMES } from '@/data/teams';

interface Props {
  currentTeam: string | null;
  onClose: () => void;
  onSelect: (team: string | null) => void;
  isOnboarding?: boolean;
}

export default function FavoriteTeamModal({
  currentTeam,
  onClose,
  onSelect,
  isOnboarding = false,
}: Props) {
  const [selected, setSelected] = useState<string | null>(currentTeam);

  const handleConfirm = () => {
    onSelect(selected);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center"
      style={{
        backgroundColor: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.2s',
      }}
      onClick={isOnboarding ? undefined : onClose}
    >
      <div
        className="w-full max-w-[480px] bg-white rounded-t-3xl p-6 pb-10"
        style={{ animation: 'slideUp 0.3s' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Heart size={20} className="text-toss-red" fill="#FF3B30" />
            <h3 className="text-lg font-bold text-toss-gray-900">
              {isOnboarding ? '응원하는 팀을 선택하세요' : '즐겨찾는 팀 변경'}
            </h3>
          </div>
          {!isOnboarding && (
            <button onClick={onClose} className="text-toss-gray-400">
              <X size={22} />
            </button>
          )}
        </div>
        <p className="text-sm text-toss-gray-500 mb-5">
          선택한 팀은 순위표에서 하이라이트로 표시돼요
        </p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {TEAM_NAMES.map((name) => {
            const info = TEAMS[name];
            const isSelected = selected === name;
            return (
              <button
                key={name}
                onClick={() => setSelected(isSelected ? null : name)}
                className="flex items-center gap-2 px-3 py-3 rounded-xl border-2 transition-all active:scale-95"
                style={{
                  borderColor: isSelected ? info.color : '#E5E8EB',
                  backgroundColor: isSelected ? info.bgLight : '#FFFFFF',
                }}
              >
                <span className="text-2xl">{info.emoji}</span>
                <div className="text-left flex-1 min-w-0">
                  <p
                    className="font-semibold text-sm truncate"
                    style={{ color: isSelected ? info.color : '#191F28' }}
                  >
                    {info.name}
                  </p>
                  <p className="text-[11px] text-toss-gray-500 truncate">
                    {info.hometown}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {!isOnboarding && selected === null && currentTeam !== null && (
          <p className="text-xs text-toss-orange text-center mb-3">
            ⚠️ 즐겨찾기가 해제돼요
          </p>
        )}

        <div className="flex gap-2">
          {!isOnboarding && (
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-toss-gray-100 text-toss-gray-700 font-semibold"
            >
              취소
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={isOnboarding && !selected}
            className="flex-[2] py-3 rounded-xl font-bold text-white disabled:opacity-40"
            style={{
              backgroundColor: selected
                ? TEAMS[selected]?.color || '#3182F6'
                : '#3182F6',
            }}
          >
            {isOnboarding
              ? selected
                ? `${TEAMS[selected].emoji} ${selected} 팬입니다!`
                : '팀을 선택해주세요'
              : '확인'}
          </button>
        </div>

        {isOnboarding && (
          <button
            onClick={() => {
              onSelect(null);
              onClose();
            }}
            className="w-full mt-3 py-2 text-toss-gray-500 text-sm"
          >
            나중에 설정하기
          </button>
        )}
      </div>
    </div>
  );
}
