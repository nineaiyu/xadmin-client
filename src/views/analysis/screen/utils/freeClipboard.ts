import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import type { DashboardItem, DatasetItem } from "@/api/dataset/datasets";
import { clampFreeBox, type FreeDesign } from "./freeLayout";
import { genPaneId, paneBody } from "./layout";
import {
  readScreenStorage,
  removeScreenStorage,
  writeScreenStorage
} from "./screenStorage";
import type { InsertSummary } from "./types";

/**
 * 自由画布剪贴板（localStorage 持久化 → 支持跨大屏 / 跨会话粘贴）。
 *
 * 与「我的模板」共用同一条**插入链路** `insertPanes`：过滤引用不可见的窗格
 * （服务端保存时会拒，提前在此丢掉并计数）→ 新 pk → 层叠偏移 → 夹回画幅 →
 * 数量上限截断。这样粘贴 / 复制 / 应用模板三处行为完全一致。
 */
export const FREE_CLIPBOARD_KEY = "free-clipboard";
export const FREE_CLIPBOARD_VERSION = 1;
/** 粘贴 / 复制 / 应用模板的层叠偏移（px，同层叠语义） */
export const FREE_PASTE_OFFSET = 24;

export type FreeClipboard = {
  version: number;
  /** 来源画幅（跨画幅粘贴不做比例缩放，仅作为信息保留） */
  design: FreeDesign;
  panes: ScreenLayoutPane[];
  copied_at: number;
};

/** 打包选区为剪贴板载荷（空选区返回 null） */
export function createClipboard(
  panes: readonly ScreenLayoutPane[],
  pks: readonly string[],
  design: FreeDesign
): FreeClipboard | null {
  const chosen = panes.filter(pane => pks.includes(pane.pk));
  if (chosen.length === 0) return null;
  return {
    version: FREE_CLIPBOARD_VERSION,
    design: { ...design },
    panes: chosen.map(pane => ({ ...pane })),
    copied_at: Date.now()
  };
}

export function writeClipboard(payload: FreeClipboard): boolean {
  return writeScreenStorage(FREE_CLIPBOARD_KEY, payload);
}

export function clearClipboard(): void {
  removeScreenStorage(FREE_CLIPBOARD_KEY);
}

/** 读取剪贴板（版本不符 / 结构非法 / 存储异常一律视为空） */
export function readClipboard(): FreeClipboard | null {
  const raw = readScreenStorage<FreeClipboard>(FREE_CLIPBOARD_KEY);
  if (!raw || raw.version !== FREE_CLIPBOARD_VERSION) return null;
  if (!Array.isArray(raw.panes) || raw.panes.length === 0) return null;
  return raw;
}

/**
 * 插入链路（粘贴 / 就地复制 / 应用模板共用）。
 *
 * `limit` = 本次允许插入的数量上限（调用方按剩余容量算）；`offset` 默认层叠偏移，
 * 就地复制 / 应用模板可传 0（保持原坐标，由调用方决定是否偏移）。
 */
export function insertPanes({
  source,
  design,
  dashboards,
  datasets,
  limit,
  offset = FREE_PASTE_OFFSET
}: {
  source: readonly ScreenLayoutPane[];
  design: FreeDesign;
  dashboards: readonly DashboardItem[];
  datasets: readonly DatasetItem[];
  limit: number;
  offset?: number;
}): { panes: ScreenLayoutPane[]; summary: InsertSummary } {
  const visibleDashboards = new Set(dashboards.map(item => item.pk));
  const visibleDatasets = new Set(datasets.map(item => item.pk));
  const usable = source.filter(pane => {
    if (pane.type === "dashboard")
      return Boolean(pane.dashboard) && visibleDashboards.has(pane.dashboard!);
    if (pane.type === "metric")
      return Boolean(pane.dataset) && visibleDatasets.has(pane.dataset!);
    return true;
  });
  const capped = usable.slice(0, Math.max(limit, 0));
  const panes = capped.map(pane => {
    const box = clampFreeBox(
      { x: pane.x + offset, y: pane.y + offset, w: pane.w, h: pane.h },
      design
    );
    return { ...paneBody(pane), ...box, pk: genPaneId() };
  });
  return {
    panes,
    summary: {
      inserted: panes.length,
      skippedRefs: source.length - usable.length,
      truncated: usable.length - capped.length
    }
  };
}
