import type { ScreenLayoutPane, ScreenPaneType } from "@/api/dataset/analysis";
import { clampRotate } from "./paneEffects";

/**
 * 多选批量改属性（纯函数 + 单测；拆分动机：编辑域组合层行数门禁）。
 *
 * **统一值语义**：把同一个值写给选区里「该字段适用」的窗格；适用性口径与服务端
 * `_normalize_pane_body` 一致——避免把 `text_format` 塞给时钟、把 `size` 塞给图片这类
 * 「注定被服务端丢掉」的写入。`rotate` / `animation` 适用于全部类型。
 */
const ALL_PANE_TYPES: ScreenPaneType[] = [
  "dashboard",
  "text",
  "clock",
  "metric",
  "image",
  "video",
  "html"
];

export const BATCH_FIELD_APPLIES: Record<string, ScreenPaneType[]> = {
  size: ["text", "clock"],
  align: ["text"],
  text_format: ["text"],
  // 视频与图片同口径：服务端对 video.fit 做同样的归一化校验
  fit: ["image", "video"],
  // 旋转/入场动画适用于全部窗格（服务端 _normalize_pane_body 对全部类型归一化）
  rotate: ALL_PANE_TYPES,
  animation: ALL_PANE_TYPES
};

/** 归一化批量 patch：`rotate` 夹到 -180~180（其余字段由各自控件保证取值） */
export function normalizeBatchPatch(
  patch: Partial<ScreenLayoutPane>
): Partial<ScreenLayoutPane> {
  const safe: Partial<ScreenLayoutPane> = { ...patch };
  if (safe.rotate !== undefined) safe.rotate = clampRotate(safe.rotate);
  return safe;
}

/**
 * 计算批量改属性的**目标窗格**（`pk → 新窗格`）：
 * 不适用的类型跳过、值没变化的跳过（连续设置不堆空撤销点）。
 */
export function batchUpdateTargets(
  panes: readonly ScreenLayoutPane[],
  pks: readonly string[],
  patch: Partial<ScreenLayoutPane>
): Record<string, ScreenLayoutPane> {
  const keys = Object.keys(patch) as (keyof ScreenLayoutPane)[];
  const result: Record<string, ScreenLayoutPane> = {};
  if (pks.length === 0 || keys.length === 0) return result;
  const safe = normalizeBatchPatch(patch);
  for (const pane of panes) {
    if (!pks.includes(pane.pk)) continue;
    const applicable = keys.every(key =>
      (BATCH_FIELD_APPLIES[String(key)] ?? []).includes(pane.type)
    );
    if (!applicable) continue;
    if (keys.every(key => pane[key] === safe[key])) continue;
    result[pane.pk] = { ...pane, ...safe };
  }
  return result;
}

/** 批量 patch 的撤销点 key（同一次连续设置合并为一个撤销点） */
export function batchCoalesceKey(
  keys: readonly string[],
  pks: readonly string[]
): string {
  return `batch-${keys.join("-")}-${pks.join(",")}`;
}
