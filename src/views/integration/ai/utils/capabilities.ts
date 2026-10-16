import type { useI18n } from "vue-i18n";
import type { PanelTagType } from "@/components/ReActionPanel";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 能力画像条目：未探测灰（info）、支持绿、不支持红（与列表列/抽屉资料卡同口径） */
export interface CapabilityTagItem {
  key: string;
  label: string;
  type: PanelTagType;
}

/**
 * AI 档案能力画像标签（JSON / 原生工具调用 / 思考内容 + 按需探测的多模态）：
 * 列表 capabilities 列与「管理」抽屉资料卡共用同一份构建，避免口径漂移。
 */
export function capabilityTagItems(
  capabilities: Record<string, { ok?: boolean } | undefined>,
  t: TFunction
): CapabilityTagItem[] {
  const items: Array<{ key: string; label: string }> = [
    { key: "json", label: t("aiConfig.capJson") },
    { key: "tool_calls", label: t("aiConfig.capToolCalls") },
    { key: "reasoning", label: t("aiConfig.capReasoning") }
  ];
  // 视觉能力（按需探测）：仅在有探测结果时展示
  if (capabilities["vision"]) {
    items.push({ key: "vision", label: t("aiConfig.capVision") });
  }
  return items.map(item => {
    const entry = capabilities[item.key];
    return {
      key: item.key,
      label: item.label,
      type: (entry ? (entry.ok ? "success" : "danger") : "info") as PanelTagType
    };
  });
}
