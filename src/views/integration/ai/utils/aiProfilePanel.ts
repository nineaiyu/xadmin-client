import { h } from "vue";
import { ElTag } from "element-plus";
import type { useI18n } from "vue-i18n";
import type {
  PanelMetaItem,
  PanelProfileData
} from "@/components/ReActionPanel";
import type { AiProfileItem } from "@/api/ai/ai";
import { capabilityTagItems } from "./capabilities";
import { purposeLabelKey, purposeTagType } from "./purpose";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * AI 档案「管理」抽屉的资料卡与基础信息：行快照纯函数构建（零额外请求）。
 * 采样参数未配置为 null：与表单「未设置」语义一致；能力画像与列表列同口径。
 */
export function buildAiProfileData(
  row: AiProfileItem,
  t: TFunction
): PanelProfileData {
  const capabilities = (row.capabilities ?? {}) as Record<
    string,
    { ok?: boolean } | undefined
  >;
  return {
    name: row.name || "?",
    subtitle: row.model || "—",
    badgeText: (row.name || "?").slice(0, 1),
    // 名称行右侧：使用中/未激活（与列表 is_active 列同口径）
    trailing: () =>
      h(
        ElTag,
        { size: "small", type: row.is_active ? "success" : "info" },
        () =>
          row.is_active ? t("aiConfig.profileOn") : t("aiConfig.profileOff")
      ),
    tagRows: [
      {
        key: "purpose",
        caption: t("aiConfig.purpose"),
        items: [
          {
            key: "purpose",
            name: t(purposeLabelKey(row.purpose)),
            type: purposeTagType(row.purpose),
            plain: true
          }
        ]
      },
      {
        key: "capabilities",
        caption: t("aiConfig.capabilityTitle"),
        items: capabilityTagItems(capabilities, t).map(item => ({
          key: item.key,
          name: item.label,
          type: item.type
        }))
      }
    ]
  };
}

/** AI 档案「管理」抽屉基础信息（两列网格） */
export function buildAiProfileMetaItems(
  row: AiProfileItem,
  t: TFunction
): PanelMetaItem[] {
  const numText = (value: number | null | undefined): string =>
    value === null || value === undefined ? t("aiConfig.unset") : String(value);
  return [
    {
      key: "baseUrl",
      label: t("aiConfig.baseUrl"),
      value: row.base_url || "—"
    },
    { key: "model", label: t("aiConfig.model"), value: row.model || "—" },
    {
      key: "apiKey",
      label: t("aiConfig.apiKey"),
      value: row.api_key_set
        ? t("aiConfig.apiKeySet")
        : t("aiConfig.apiKeyUnset")
    },
    {
      key: "temperature",
      label: t("aiConfig.temperature"),
      value: numText(row.temperature)
    },
    {
      key: "maxTokens",
      label: t("aiConfig.maxTokens"),
      value: numText(row.max_tokens)
    },
    { key: "topP", label: t("aiConfig.topP"), value: numText(row.top_p) },
    {
      key: "contextLimit",
      label: t("aiConfig.contextLimit"),
      value: String(row.context_limit ?? 0)
    },
    {
      key: "timeout",
      label: t("aiConfig.timeout"),
      value: String(row.timeout ?? 0)
    },
    {
      key: "maxRetries",
      label: t("aiConfig.maxRetries"),
      value: String(row.max_retries ?? 0)
    },
    { key: "seed", label: t("aiConfig.seed"), value: numText(row.seed) },
    {
      key: "probedAt",
      label: t("aiConfig.probeAt"),
      value: row.probed_at || "—"
    },
    {
      key: "remark",
      label: t("aiConfig.remark"),
      value: row.remark || "—"
    }
  ];
}
