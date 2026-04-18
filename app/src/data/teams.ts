/**
 * KBO 10개 팀 정보
 */

export interface TeamInfo {
  name: string;
  fullName: string;
  color: string;
  bgLight: string;
  emoji: string;
  hometown: string;
  logoUrl: string;
}

export const TEAMS: Record<string, TeamInfo> = {
  삼성: { name: '삼성', fullName: '삼성 라이온즈', color: '#074CA1', bgLight: '#E8F0FB', emoji: '🦁', hometown: '대구', logoUrl: '' },
  LG:   { name: 'LG',   fullName: 'LG 트윈스',    color: '#C30452', bgLight: '#FCE8EF', emoji: '👬', hometown: '서울', logoUrl: '' },
  KT:   { name: 'KT',   fullName: 'KT 위즈',      color: '#000000', bgLight: '#F0F0F0', emoji: '🧙', hometown: '수원', logoUrl: '' },
  SSG:  { name: 'SSG',  fullName: 'SSG 랜더스',   color: '#CE0E2D', bgLight: '#FCE4E9', emoji: '⛵', hometown: '인천', logoUrl: '' },
  KIA:  { name: 'KIA',  fullName: 'KIA 타이거즈', color: '#EA0029', bgLight: '#FCE0E5', emoji: '🐯', hometown: '광주', logoUrl: '' },
  NC:   { name: 'NC',   fullName: 'NC 다이노스',  color: '#315288', bgLight: '#E5EBF4', emoji: '🦖', hometown: '창원', logoUrl: '' },
  한화: { name: '한화', fullName: '한화 이글스',  color: '#FF6600', bgLight: '#FFEEDE', emoji: '🦅', hometown: '대전', logoUrl: '' },
  롯데: { name: '롯데', fullName: '롯데 자이언츠', color: '#041E42', bgLight: '#DDE2EA', emoji: '🌊', hometown: '부산', logoUrl: '' },
  두산: { name: '두산', fullName: '두산 베어스',  color: '#131230', bgLight: '#D8D7DD', emoji: '🐻', hometown: '서울', logoUrl: '' },
  키움: { name: '키움', fullName: '키움 히어로즈', color: '#570514', bgLight: '#EDD9DD', emoji: '🦸', hometown: '서울', logoUrl: '' },
};

export const TEAM_NAMES = Object.keys(TEAMS);

export function getTeam(name: string): TeamInfo {
  return (
    TEAMS[name] || {
      name,
      fullName: name,
      color: '#8B95A1',
      bgLight: '#F2F4F6',
      emoji: '⚾',
      hometown: '',
      logoUrl: '',
    }
  );
}