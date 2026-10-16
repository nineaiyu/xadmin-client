import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import { FREE_DESIGN_DEFAULTS, type FreeDesign } from "./freeLayout";
import { genPaneId } from "./layout";
import { readScreenStorage, writeScreenStorage } from "./screenStorage";
import type { TranslateFn } from "./types";

/**
 * 自由画布模板：**内置 3 个**（纯结构，不含任何数据引用，任何环境可用）+
 * **「我的模板」**（localStorage：保存当前画布骨架，支持应用 / 重命名 / 删除 / 导出 JSON）。
 *
 * 模板与剪贴板共用插入链路（见 `freeClipboard.insertPanes`）：应用时按当前可见清单
 * 过滤引用、生成新 pk、层叠偏移、夹回画幅。模板**保留数据引用**（同环境复用最有用），
 * 跨环境不可见的引用在应用时被丢弃并计数提示。
 */
export const FREE_TEMPLATE_KEY = "free-templates";
export const FREE_TEMPLATE_VERSION = 1;
/** 我的模板数量上限（本地存储，够用即可） */
export const FREE_TEMPLATE_LIMIT = 20;

export type FreeTemplate = {
  id: string;
  name: string;
  /** 分组（团队模板用；本地 / 内置为空串） */
  group?: string;
  /** 内置模板不可改名 / 删除 */
  builtin: boolean;
  /**
   * 来源：内置 / 本地（localStorage）/ 团队（服务端，ADR-088）。
   * 缺省按内置处理（老版本落盘的本土模板没有该字段，语义上仍是「我的模板」，
   * 故读取侧显式补 "local"，见 `listMyTemplates`）。
   */
  source?: "builtin" | "local" | "server";
  /** 团队模板：是否本人创建（非本人只读：不可重命名 / 删除） */
  is_owner?: boolean;
  /** 团队模板可见性 */
  visibility?: "personal" | "shared";
  design: FreeDesign;
  panes: ScreenLayoutPane[];
  updated_at: number;
};

/** 文本窗格简写（内置模板只用到文本 / 时钟：零引用依赖） */
function textPane(
  key: string,
  box: { x: number; y: number; w: number; h: number },
  label: string,
  size: number,
  align: "left" | "center"
): ScreenLayoutPane {
  return {
    pk: `tpl-${key}`,
    type: "text",
    ...box,
    text: label,
    size,
    align
  };
}

/** 内置模板（文案走 i18n；结构固定，应用时按当前画幅夹回） */
export function builtinTemplates(t: TranslateFn): FreeTemplate[] {
  const design: FreeDesign = { ...FREE_DESIGN_DEFAULTS };
  return [
    {
      id: "builtin-promo",
      name: t("dataScreen.tplPromo"),
      builtin: true,
      design,
      updated_at: 0,
      panes: [
        {
          pk: "tpl-promo-clock",
          type: "clock",
          x: 820,
          y: 240,
          w: 280,
          h: 90,
          size: 56
        },
        textPane(
          "promo-title",
          { x: 160, y: 430, w: 1600, h: 150 },
          t("dataScreen.tplPromoTitle"),
          88,
          "center"
        ),
        textPane(
          "promo-subtitle",
          { x: 360, y: 600, w: 1200, h: 70 },
          t("dataScreen.tplPromoSubtitle"),
          32,
          "center"
        )
      ]
    },
    {
      id: "builtin-report",
      name: t("dataScreen.tplReport"),
      builtin: true,
      design,
      updated_at: 0,
      panes: [
        textPane(
          "report-title",
          { x: 80, y: 70, w: 1400, h: 80 },
          t("dataScreen.tplReportTitle"),
          48,
          "left"
        ),
        textPane(
          "report-body-1",
          { x: 80, y: 230, w: 1180, h: 70 },
          t("dataScreen.tplReportBody"),
          28,
          "left"
        ),
        textPane(
          "report-body-2",
          { x: 80, y: 340, w: 1180, h: 70 },
          t("dataScreen.tplReportBody"),
          28,
          "left"
        ),
        textPane(
          "report-body-3",
          { x: 80, y: 450, w: 1180, h: 70 },
          t("dataScreen.tplReportBody"),
          28,
          "left"
        ),
        textPane(
          "report-footer",
          { x: 80, y: 980, w: 1760, h: 40 },
          t("dataScreen.tplReportFooter"),
          20,
          "left"
        )
      ]
    },
    {
      id: "builtin-skeleton",
      name: t("dataScreen.tplSkeleton"),
      builtin: true,
      design,
      updated_at: 0,
      panes: [
        textPane(
          "skeleton-title",
          { x: 80, y: 60, w: 1200, h: 70 },
          t("dataScreen.tplSkeletonTitle"),
          44,
          "left"
        ),
        textPane(
          "skeleton-section-1",
          { x: 80, y: 160, w: 560, h: 48 },
          t("dataScreen.tplSkeletonSection"),
          28,
          "left"
        ),
        textPane(
          "skeleton-section-2",
          { x: 680, y: 160, w: 560, h: 48 },
          t("dataScreen.tplSkeletonSection"),
          28,
          "left"
        ),
        textPane(
          "skeleton-section-3",
          { x: 1280, y: 160, w: 560, h: 48 },
          t("dataScreen.tplSkeletonSection"),
          28,
          "left"
        ),
        {
          pk: "tpl-skeleton-clock",
          type: "clock",
          x: 1700,
          y: 60,
          w: 160,
          h: 64,
          size: 44
        }
      ]
    }
  ];
}

/** 我的模板（读盘 + 结构校验；内置项不落盘，防人工改坏） */
export function listMyTemplates(): FreeTemplate[] {
  const raw = readScreenStorage<{ version: number; items: FreeTemplate[] }>(
    FREE_TEMPLATE_KEY
  );
  if (!raw || raw.version !== FREE_TEMPLATE_VERSION) return [];
  if (!Array.isArray(raw.items)) return [];
  return raw.items
    .filter(
      item =>
        item &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        Array.isArray(item.panes) &&
        item.panes.length > 0
    )
    .map(item => ({ ...item, builtin: false, source: "local" as const }))
    .sort((a, b) => b.updated_at - a.updated_at);
}

/** 内置 + 我的（内置固定在前，保持稳定顺序）；团队模板由服务端薄层单独取 */
export function listTemplates(t: TranslateFn): FreeTemplate[] {
  return [
    ...builtinTemplates(t).map(item => ({
      ...item,
      source: "builtin" as const
    })),
    ...listMyTemplates()
  ];
}

/**
 * 模板按分组聚合（团队模板下拉用）：组名先去空白，**空分组排最后**（落到「未分组」），
 * 其余组名按本地化顺序排；组内保持传入顺序（服务端已按更新时间倒序）。
 * 纯函数：组件只负责渲染，排序 / 归并口径可单测。
 */
export function groupTemplates(
  templates: readonly FreeTemplate[]
): { group: string; items: FreeTemplate[] }[] {
  const buckets = new Map<string, FreeTemplate[]>();
  for (const item of templates) {
    const key = (item.group ?? "").trim();
    buckets.set(key, [...(buckets.get(key) ?? []), item]);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)))
    .map(([group, items]) => ({ group, items }));
}

function writeMine(items: FreeTemplate[]): boolean {
  return writeScreenStorage(FREE_TEMPLATE_KEY, {
    version: FREE_TEMPLATE_VERSION,
    items
  });
}

export type SaveTemplateResult =
  | { ok: true; template: FreeTemplate }
  | { ok: false; error: "empty" | "name" | "limit" | "storage" };

/** 保存当前自由画布为模板（结构与样式 + 数据引用；名称必填） */
export function saveTemplate({
  name,
  design,
  panes,
  pks
}: {
  name: string;
  design: FreeDesign;
  panes: readonly ScreenLayoutPane[];
  pks: readonly string[];
}): SaveTemplateResult {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "name" };
  const chosen = panes.filter(pane => pks.includes(pane.pk));
  if (chosen.length === 0) return { ok: false, error: "empty" };
  const mine = listMyTemplates();
  if (mine.length >= FREE_TEMPLATE_LIMIT) return { ok: false, error: "limit" };
  const template: FreeTemplate = {
    id: `tpl-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`,
    name: trimmed.slice(0, 40),
    builtin: false,
    source: "local",
    design: { ...design },
    panes: chosen.map(pane => ({ ...pane })),
    updated_at: Date.now()
  };
  return writeMine([template, ...mine])
    ? { ok: true, template }
    : { ok: false, error: "storage" };
}

export function renameTemplate(id: string, name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const mine = listMyTemplates();
  const index = mine.findIndex(item => item.id === id);
  if (index < 0) return false;
  mine[index] = {
    ...mine[index],
    name: trimmed.slice(0, 40),
    updated_at: Date.now()
  };
  return writeMine(mine);
}

export function removeTemplate(id: string): boolean {
  const mine = listMyTemplates();
  const next = mine.filter(item => item.id !== id);
  if (next.length === mine.length) return false;
  return writeMine(next);
}

/** 模板窗格副本（生成新 pk；应用时走插入链路） */
export function templatePanes(template: FreeTemplate): ScreenLayoutPane[] {
  return template.panes.map(pane => ({ ...pane, pk: genPaneId() }));
}
