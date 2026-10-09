import { h, type ShallowRef } from "vue";
import type { useI18n } from "vue-i18n";
import { ElLink, ElSwitch, ElTag, ElTooltip } from "element-plus";
import {
  formatPageColumns,
  type PageTableColumn
} from "@/components/RePlusPage";
import { type buildScopeIndex, formatScopeLines } from "@/utils/scopeDisplay";
import type { ApiApplicationItem } from "@/api/system/open";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * API 应用列渲染（自 api-app/utils/hook 抽出）：应用名（同为「管理」抽屉入口）、
 * 接口范围（tooltip 展示可读路径）、行内启停开关与 client_id 列宽。
 */
export function useApiAppColumns({
  t,
  canEdit,
  scopeIndex,
  toggleActive,
  openApiAppPanel
}: {
  t: TFunction;
  canEdit: boolean;
  scopeIndex: ShallowRef<ReturnType<typeof buildScopeIndex>>;
  toggleActive: (row: ApiApplicationItem, value: boolean) => Promise<void>;
  openApiAppPanel: (row: ApiApplicationItem) => void;
}) {
  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      name: column => {
        // 应用名同为「管理」抽屉入口：名称即实体标识，点击最直观
        column["cellRenderer"] = ({ row }) => {
          const item = row as ApiApplicationItem;
          return h(
            ElLink,
            {
              type: "primary",
              onClick: () => openApiAppPanel(item)
            },
            () => item.name
          );
        };
      },
      scopes: column => {
        // 明细走 tooltip：条目本体是锚定正则，列内只显示条数，hover 看到可读路径
        column["minWidth"] = 130;
        column["cellRenderer"] = ({ row }) => {
          const scopes = (row as ApiApplicationItem).scopes ?? [];
          if (!scopes.length) return t("apiApp.unlimited");
          return h(
            ElTooltip,
            { placement: "top" },
            {
              default: () =>
                h(ElTag, { type: "info", size: "small" }, () =>
                  t("apiApp.scopeCount", { n: scopes.length })
                ),
              content: () =>
                h(
                  "div",
                  {
                    class: "text-xs",
                    style: { maxWidth: "420px", whiteSpace: "pre-line" }
                  },
                  formatScopeLines(scopes, scopeIndex.value)
                )
            }
          );
        };
      },
      is_active: column => {
        column["cellRenderer"] = ({ row }) =>
          h(ElSwitch, {
            modelValue: (row as ApiApplicationItem).is_active,
            disabled: !canEdit,
            "onUpdate:modelValue": (value: string | number | boolean) =>
              toggleActive(row as ApiApplicationItem, value as boolean)
          });
      },
      client_id: column => {
        column["minWidth"] = 220;
      }
    });

  return { listColumnsFormat };
}
