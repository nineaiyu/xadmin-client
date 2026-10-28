import type { ScreenLayoutPane, ScreenPaneType } from "@/api/dataset/analysis";
import {
  FREE_DESIGN_DEFAULTS,
  FREE_MAX_PANES,
  clampDesign,
  clampFreeBox,
  type FreeDesign
} from "./freeLayout";
import {
  genPaneId,
  isValidPaneEmbedUrl,
  isValidPaneImageUrl,
  paneBody
} from "./layout";

/**
 * 模板 JSON 的序列化与反序列化（纯函数，单测见 `__tests__/templateJson.spec.ts`）。
 *
 * 导出供备份 / 人工编辑，导入是**不信任外部输入**的入口：解析即归一化——窗格逐个
 * 过类型白名单与画幅夹取，认不出的整格丢掉并计数，绝不把半成品写进画布；
 * 形状不对（不是 JSON / 没有窗格 / 太大）给可读错误，调用方提示后不落任何数据。
 *
 * 与服务端的关系：导入产物最终仍走保存校验（服务端是唯一写权威），这里的归一化
 * 只是把「注定被拒」提前到导入那一刻暴露，而不是当作校验的替代品。
 */
export const TEMPLATE_JSON_VERSION = 1;
/** 导入文件大小上限（生成的模板 JSON 通常只有几 KB；挡住误选的大文件） */
export const TEMPLATE_JSON_MAX_BYTES = 256 * 1024;

/**
 * 导入类型白名单：必须与服务端 `screen_layout.py::SCREEN_PANE_TYPES` 同源
 * （漏项会让「导出再导入」静默丢窗格；守护测试钉住两侧清单一致）。
 */
export const PANE_TYPES: ScreenPaneType[] = [
  "dashboard",
  "text",
  "clock",
  "metric",
  "image",
  "video",
  "html"
];

export type ParsedTemplate = {
  name: string;
  design: FreeDesign;
  panes: ScreenLayoutPane[];
  /** 被丢弃的窗格数（形状不合法 / 引用缺失 / 超出数量上限） */
  skipped: number;
};

export type TemplateParseResult =
  | { ok: true; value: ParsedTemplate }
  | { ok: false; error: "format" | "empty" | "too-large" };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** 单个窗格：形状 + 类型必填项过关才保留（否则返回 null 由调用方计数丢弃） */
function parsePane(raw: unknown, design: FreeDesign): ScreenLayoutPane | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const type = String(item.type ?? "text") as ScreenPaneType;
  if (!PANE_TYPES.includes(type)) return null;
  if (
    !isFiniteNumber(item.x) ||
    !isFiniteNumber(item.y) ||
    !isFiniteNumber(item.w) ||
    !isFiniteNumber(item.h)
  ) {
    return null;
  }
  if (type === "dashboard" && !String(item.dashboard ?? "").trim()) return null;
  if (type === "metric" && !String(item.dataset ?? "").trim()) return null;
  // 媒体类型 url 必填，且格式与服务端同口径（image/video 收根相对路径，html 只收 http(s)）：
  // 空 url / 非法协议的窗格注定被保存校验拒绝，导入时就丢弃并计数
  if (type === "image" || type === "video" || type === "html") {
    const url = String(item.url ?? "").trim();
    if (!url) return null;
    const allowed =
      type === "html" ? isValidPaneEmbedUrl(url) : isValidPaneImageUrl(url);
    if (!allowed) return null;
  }

  const box = clampFreeBox(
    {
      x: Math.round(item.x),
      y: Math.round(item.y),
      w: Math.round(item.w),
      h: Math.round(item.h)
    },
    design
  );
  const source = {
    ...(item as Partial<ScreenLayoutPane>),
    pk: genPaneId(),
    type,
    ...box
  } as ScreenLayoutPane;
  return { ...paneBody(source), ...box };
}

/**
 * 解析导入的模板 JSON。入参可为对象载荷 `{name, design, panes}` 或窗格数组
 * （手写 / 简写文件都能吃），窗格数超上限按上限截断并计入 `skipped`。
 */
export function parseTemplateJson(raw: string): TemplateParseResult {
  if (raw.length > TEMPLATE_JSON_MAX_BYTES)
    return { ok: false, error: "too-large" };
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return { ok: false, error: "format" };
  }

  const isArray = Array.isArray(payload);
  const record = (isArray ? {} : payload) as Record<string, unknown>;
  const rawPanes = isArray ? payload : record.panes;
  if (!Array.isArray(rawPanes)) return { ok: false, error: "format" };

  const design = clampDesign(
    (record.design as Partial<FreeDesign> | undefined) ??
      (record.design_w || record.design_h
        ? {
            design_w: Number(record.design_w),
            design_h: Number(record.design_h)
          }
        : FREE_DESIGN_DEFAULTS)
  );

  const panes: ScreenLayoutPane[] = [];
  let skipped = 0;
  for (const item of rawPanes) {
    const pane = parsePane(item, design);
    if (!pane) {
      skipped += 1;
      continue;
    }
    if (panes.length >= FREE_MAX_PANES) {
      skipped += 1;
      continue;
    }
    panes.push(pane);
  }
  if (panes.length === 0) return { ok: false, error: "empty" };

  const name = String(record.name ?? "").trim();
  return {
    ok: true,
    value: { name, design, panes, skipped }
  };
}

/** 导出为 JSON 文本（与 `parseTemplateJson` 可往返：导出再导入结果一致） */
export function exportTemplateJson(template: {
  name: string;
  design: FreeDesign;
  panes: readonly ScreenLayoutPane[];
}): string {
  return JSON.stringify(
    {
      version: TEMPLATE_JSON_VERSION,
      name: template.name,
      design: template.design,
      panes: template.panes
    },
    null,
    2
  );
}
