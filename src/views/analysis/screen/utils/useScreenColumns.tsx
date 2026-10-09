import { h } from "vue";
import type { Ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElTag } from "element-plus";
import { choiceValue, statusTagProps, type StatusTagType } from "@/utils/dict";
import {
  formatPageColumns,
  type PageTableColumn
} from "@/components/RePlusPage";
import type { ScreenItem } from "@/api/dataset/analysis";
import type { DashboardItem } from "@/api/dataset/datasets";

/** 可见性兜底配色（与数据集同款语义） */
const VISIBILITY_TAG: Record<string, StatusTagType> = {
  shared: "success",
  personal: "info"
};

/**
 * 大屏列表列渲染（自 hook.tsx 抽出，行数门禁）：仪表盘序列（pk 映射名称）与
 * 可见性（LabeledChoiceField → 彩色 tag）。
 */
export function useScreenColumns({
  dashboards
}: {
  dashboards: Ref<DashboardItem[]>;
}) {
  const { t } = useI18n();

  const dashboardName = (pk: string) =>
    dashboards.value.find(item => item.pk === pk)?.name ?? pk;

  const visibilityLabel = (value: string) =>
    value === "shared" ? t("dataScreen.shared") : t("dataScreen.personal");

  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      dashboards: column => {
        column["minWidth"] = 220;
        column["cellRenderer"] = ({ row }) => {
          const pks = (row as ScreenItem).dashboards || [];
          return h("span", pks.map(pk => dashboardName(pk)).join(" → ") || "—");
        };
      },
      visibility: column => {
        column["cellRenderer"] = ({ row }) => {
          const raw = (row as ScreenItem).visibility;
          const value = choiceValue(raw);
          return h(
            ElTag,
            { size: "small", ...statusTagProps(raw, VISIBILITY_TAG) },
            () => visibilityLabel(value)
          );
        };
      }
    });

  return { listColumnsFormat };
}
