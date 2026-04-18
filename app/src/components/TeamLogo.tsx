import { useState } from 'react';
import { getTeam } from '@/data/teams';

interface Props {
  team: string;
  size?: number;
}

/**
 * 팀 로고 이미지
 * - logoUrl에서 로딩 시도
 * - 실패 시 이모지로 폴백
 */
export default function TeamLogo({ team, size = 28 }: Props) {
  const info = getTeam(team);
  const [failed, setFailed] = useState(false);

  if (failed || !info.logoUrl) {
    return (
      <span style={{ fontSize: size * 0.9, lineHeight: 1 }}>
        {info.emoji}
      </span>
    );
  }

  return (
    <img
      src={info.logoUrl}
      alt={team}
      width={size}
      height={size}
      style={{ objectFit: 'contain' }}
      onError={() => setFailed(true)}
    />
  );
}