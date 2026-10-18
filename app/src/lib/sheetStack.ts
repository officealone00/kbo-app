/**
 * 열린 바텀시트 목록 (2026-10-18)
 * 토스 뒤로가기를 누르면 가장 위의 시트부터 닫기 위해 사용해요.
 */
const stack: Array<() => void> = [];

export function pushSheet(close: () => void) {
  stack.push(close);
  return () => {
    const i = stack.lastIndexOf(close);
    if (i >= 0) stack.splice(i, 1);
  };
}

/** 열린 시트가 있으면 닫고 true */
export function closeTopSheet(): boolean {
  const close = stack[stack.length - 1];
  if (!close) return false;
  close();
  return true;
}
