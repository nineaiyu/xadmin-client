import { h } from "vue";
import type { useI18n } from "vue-i18n";
import { ElLink, ElTag } from "element-plus";
import type { PageTableColumn } from "@/components/RePlusPage";
import type { AiProfileItem } from "@/api/ai/ai";
import { purposeLabelKey, purposeTagType } from "./purpose";
import { capabilityTagItems } from "./capabilities";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * AI 档案列渲染（自 useAiProfiles 抽出）：档案名（同为「管理」抽屉入口）、
 * 激活状态彩色 tag、未配置采样参数、用途标签与能力画像。
 */
export function useAiProfileColumns({
  t,
  openProfilePanel
}: {
  t: TFunction;
  openProfilePanel: (row: AiProfileItem) => void;
}) {
  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "name":
          // 档案名同为「管理」抽屉入口
          column["cellRenderer"] = ({ row }) => {
            const item = row as AiProfileItem;
            return h(
              ElLink,
              {
                type: "primary",
                onClick: () => openProfilePanel(item)
              },
              () => item.name
            );
          };
          break;
        case "is_active":
          column["cellRenderer"] = ({ row }) => {
            const active = (row as AiProfileItem).is_active;
            return h(
              ElTag,
              { size: "small", type: active ? "success" : "info" },
              () =>
                active ? t("aiConfig.profileOn") : t("aiConfig.profileOff")
            );
          };
          break;
        case "temperature":
        case "max_tokens":
          // 采样参数未配置为 null：与表单「未设置」语义一致
          column["cellRenderer"] = ({ row }) => {
            const value = (row as Record<string, unknown>)[
              column.prop as string
            ];
            return value == null ? t("aiConfig.unset") : String(value);
          };
          break;
        case "purpose":
          column["cellRenderer"] = ({ row }) => {
            const purpose = (row as AiProfileItem).purpose;
            return h(
              ElTag,
              { size: "small", type: purposeTagType(purpose) },
              () => t(purposeLabelKey(purpose))
            );
          };
          break;
        case "capabilities":
          // 能力画像：与「管理」抽屉资料卡共用 capabilityTagItems 构建
          column["cellRenderer"] = ({ row }) => {
            const capabilities = ((row as AiProfileItem).capabilities ??
              {}) as Record<string, { ok?: boolean } | undefined>;
            return h(
              "div",
              { class: "flex flex-wrap gap-1" },
              capabilityTagItems(capabilities, t).map(item =>
                h(
                  ElTag,
                  { key: item.key, size: "small", type: item.type },
                  () => item.label
                )
              )
            );
          };
          break;
      }
    });
    return columns;
  };

  return { listColumnsFormat };
}
