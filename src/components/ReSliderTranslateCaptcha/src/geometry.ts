/**
 * 拼图验证码几何（纯函数）：可移动区间、滑条位移映射、随机位置、通过判定。
 */

/** 拼图块可移动的最大偏移（图片边长 - 拼图块边长） */
export function pieceMaxOffset(imageSize: number, pieceSize: number): number {
  return Math.max(imageSize - pieceSize, 0);
}

/** 滑条位移 → 拼图块 left：把滑条行程等比映射到拼图可移动区间 */
export function pieceLeftFromMove(
  moveX: number,
  trackMax: number,
  imageSize: number,
  pieceSize: number
): number {
  const max = pieceMaxOffset(imageSize, pieceSize);
  if (trackMax <= 0 || max <= 0) return 0;
  return Math.min(Math.max((moveX / trackMax) * max, 0), max);
}

/** 随机偏移（`[0, 可移动区间]` 内的整数）：目标 left 与纵向 top 共用 */
export function randomOffset(
  imageSize: number,
  pieceSize: number,
  random: () => number = Math.random
): number {
  return Math.floor(random() * (pieceMaxOffset(imageSize, pieceSize) + 1));
}

/** 是否通过：拼图块 left 与目标 left 之差在容差内 */
export function isTranslatePassing(
  target: number,
  current: number,
  diffX: number
): boolean {
  return Math.abs(target - current) <= Math.max(0, diffX);
}
