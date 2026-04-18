import { getTeam } from '@/data/teams';

interface Props {
  team: string;
  size?: 'sm' | 'md' | 'lg';
  showEmoji?: boolean;
}

export default function TeamBadge({ team, size = 'md', showEmoji = false }: Props) {
  const info = getTeam(team);
  const sizeClasses = {
    sm: 'text-[11px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-3 py-1.5',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-bold ${sizeClasses[size]}`}
      style={{
        backgroundColor: info.bgLight,
        color: info.color,
      }}
    >
      {showEmoji && <span>{info.emoji}</span>}
      {info.name}
    </span>
  );
}
