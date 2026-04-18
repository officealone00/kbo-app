/**
 * 즐겨찾기 팀 & 설정 관리 (localStorage)
 */

const KEYS = {
  favoriteTeam: 'kbo-favorite-team',
  hasOnboarded: 'kbo-has-onboarded',
  interstitialCount: 'kbo-interstitial-count',
};

export function getFavoriteTeam(): string | null {
  try {
    return localStorage.getItem(KEYS.favoriteTeam);
  } catch {
    return null;
  }
}

export function setFavoriteTeam(team: string | null): void {
  try {
    if (team) localStorage.setItem(KEYS.favoriteTeam, team);
    else localStorage.removeItem(KEYS.favoriteTeam);
  } catch {}
}

export function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(KEYS.hasOnboarded) === '1';
  } catch {
    return false;
  }
}

export function markOnboarded(): void {
  try {
    localStorage.setItem(KEYS.hasOnboarded, '1');
  } catch {}
}

// ─── 전면광고 카운터 (N번에 1회 표시) ───
export function getInterstitialCount(): number {
  try {
    return parseInt(localStorage.getItem(KEYS.interstitialCount) || '0', 10);
  } catch {
    return 0;
  }
}

export function incrementInterstitialCount(): number {
  const n = getInterstitialCount() + 1;
  try {
    localStorage.setItem(KEYS.interstitialCount, String(n));
  } catch {}
  return n;
}

export function resetInterstitialCount(): void {
  try {
    localStorage.setItem(KEYS.interstitialCount, '0');
  } catch {}
}
