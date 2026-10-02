/** 向量索引构建轮询参数与进度里程碑（纯函数，供单测直接覆盖） */

/** 构建进度轮询节奏：2s 间隔；超时 10 分钟（供应商级全量重算的理论上界） */
export const BUILD_POLL_INTERVAL = 2000;
export const BUILD_POLL_TIMEOUT = 10 * 60 * 1000;

/** 进度里程碑（25/50/75%）：返回本次跨过的刻度，未跨过为 undefined */
export function findMilestone(
  lastPercent: number,
  percent: number
): number | undefined {
  return [25, 50, 75].find(mark => lastPercent < mark && percent >= mark);
}
