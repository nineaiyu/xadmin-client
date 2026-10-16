/**
 * 消息流时间分组（聊天室与 AI 控制台共用口径）：
 * 首条消息 / 与上一条间隔超过阈值时插入时间分隔行。
 */

/** 气泡时间分组阈值：超过该间隔另起一个时间分隔 */
export const TIME_GROUP_GAP = 5 * 60 * 1000;

export type TimeGroupRow<T> =
  | { type: "divider"; key: string; label: string }
  | { type: "message"; key: string; item: T };

/** 分隔标签：今天只显示时分；昨天带「昨天」前缀；更早显示「月-日 时分」。 */
export function formatTimeDivider(
  time: number,
  yesterdayLabel: string
): string {
  if (!time) return "";
  const date = new Date(time);
  const now = new Date();
  const hm = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  if (date.toDateString() === now.toDateString()) return hm;
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (date.toDateString() === yesterday.toDateString())
    return `${yesterdayLabel} ${hm}`;
  return `${date.getMonth() + 1}-${date.getDate()} ${hm}`;
}

/** 按 created_time 把消息列表组装为「分隔行 + 消息行」序列（渲染层直接遍历）。 */
export function groupByTime<T extends { id: number; created_time: string }>(
  items: T[],
  yesterdayLabel: string
): Array<TimeGroupRow<T>> {
  const rows: Array<TimeGroupRow<T>> = [];
  let lastTime = 0;
  for (const item of items) {
    const time = new Date(item.created_time).getTime();
    if (!lastTime || time - lastTime > TIME_GROUP_GAP) {
      rows.push({
        type: "divider",
        key: `d-${item.id}`,
        label: formatTimeDivider(time, yesterdayLabel)
      });
    }
    rows.push({ type: "message", key: `m-${item.id}`, item });
    lastTime = time;
  }
  return rows;
}
