/**
 * 旋转验证码几何（纯函数）：拖动位移 → 旋转角、随机初始角、通过判定。
 */

/** 拖动位移 → 图片旋转角：位移占图片宽度的比例 × 1.5 × maxDegree */
export function rotateFromMove(
  moveX: number,
  imageSize: number,
  maxDegree: number
): number {
  if (imageSize <= 0) return 0;
  return Math.ceil((moveX / imageSize) * 1.5 * maxDegree);
}

/** 随机初始旋转角（落在 [min, max) 内的整数） */
export function randomRotate(
  minDegree: number,
  maxDegree: number,
  random: () => number = Math.random
): number {
  const low = Math.min(minDegree, maxDegree);
  const high = Math.max(minDegree, maxDegree);
  return Math.floor(low + random() * (high - low));
}

/** 是否通过：当前旋转角与目标角之差在容差内 */
export function isRotatePassing(
  target: number,
  current: number,
  diffDegree: number
): boolean {
  return Math.abs(target - current) < Math.max(0, diffDegree);
}
