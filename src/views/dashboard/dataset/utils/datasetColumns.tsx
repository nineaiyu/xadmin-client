import { h } from "vue";
import { ElLink, ElTag } from "element-plus";
import { useRouter } from "vue-router";
import { choiceValue, statusTagProps, type StatusTagType } from "@/utils/dict";
import {
  formatPageColumns,
  type PageTableColumn
} from "@/components/RePlusPage";
import type { DatasetItem } from "@/api/dataset/datasets";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 可见性兜底配色（字典未接入时的本地映射） */
const VISIBILITY_TAG: Record<string, StatusTagType> = {
  shared: "success",
  personal: "info"
};

/**
 * 数据集列表列渲染（自 hook.tsx 抽出）：visibility 为 LabeledChoiceField
 * （label 优先、本地映射兜底配色）、被引用报表计数列（可点击跳转报表页）。
 */
export function useDatasetColumns({ t }: { t: TFunction }) {
  const router = useRouter();

  const visibilityLabel = (value: string) =>
    value === "shared" ? t("dataDataset.shared") : t("dataDataset.personal");

  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      visibility: column => {
        column["cellRenderer"] = ({ row }) => {
          const raw = (row as DatasetItem).visibility;
          const value = choiceValue(raw);
          return h(
            ElTag,
            { size: "small", ...statusTagProps(raw, VISIBILITY_TAG) },
            () => visibilityLabel(value)
          );
        };
      },
      bound_model: column => {
        column["minWidth"] = 160;
      },
      description: column => {
        column["minWidth"] = 180;
      },
      report_count: column => {
        // 联动：被几张定时报表引用（后端关联计数）可点击，跳转报表页按数据集筛选
        column["minWidth"] = 100;
        column["cellRenderer"] = ({ row }) =>
          h(
            ElLink,
            {
              type: "primary",
              underline: false,
              onClick: () =>
                router.push({
                  path: "/analysis/report/index",
                  query: { dataset: String(row.pk) }
                })
            },
            () => String(row.report_count ?? 0)
          );
      }
    });

  return { listColumnsFormat };
}
