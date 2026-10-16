import { h } from "vue";
import { useI18n } from "vue-i18n";
import { ElTag } from "element-plus";
import {
  type PageTableColumn,
  formatPageColumns
} from "@/components/RePlusPage";

/** 审批规则列表列渲染（路径清单 / 方法限定 / 级次数 / 备注）；自 utils/hook 拆出，行为不变 */
export function useRuleColumns() {
  const { t } = useI18n();

  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      path_patterns: column => {
        column["minWidth"] = 240;
        column["cellRenderer"] = ({ row }) =>
          ((row?.path_patterns ?? []) as string[]).join(" ； ") || "-";
      },
      methods: column => {
        column["width"] = 150;
        column["cellRenderer"] = ({ row }) => {
          const methods = (row?.methods ?? []) as string[];
          if (!methods.length) return t("approvalRule.methodsAll");
          return h(
            "span",
            { class: "flex flex-wrap gap-1" },
            methods.map(method =>
              h(
                ElTag,
                { key: method, size: "small", effect: "plain" },
                () => method
              )
            )
          );
        };
      },
      level_count: column => {
        column["width"] = 90;
        column["cellRenderer"] = ({ row }) =>
          t("approvalRule.levelCount", { n: Number(row?.level_count ?? 0) });
      },
      remark: column => {
        column["minWidth"] = 160;
      }
    });

  return { listColumnsFormat };
}
