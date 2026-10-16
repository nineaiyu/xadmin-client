import { shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import type { OperationProps } from "@/components/RePlusPage";
import type { ReportItem } from "@/api/dataset/analysis";

/**
 * 报表页操作区按钮（自 hook.tsx 抽出，行数门禁）：行内「立即运行 / 设计器 /
 * 编辑」与工具栏「新建」。非创建者行隐藏设计/编辑（保存会被后端守卫拒绝）；
 * 立即运行同样按 is_owner 收口：后端 run 有创建者守卫，显示只会点击后 1003。
 */
export function useReportButtons(deps: {
  canCreate: boolean;
  canEdit: boolean;
  canRun: boolean;
  run: (row: ReportItem, loading?: { value: boolean }) => void;
  design: (row: ReportItem) => void;
  openDialog: (row: ReportItem | null) => void;
}) {
  const { t } = useI18n();

  const operationButtonsProps = shallowRef<OperationProps>({
    showNumber: 5,
    width: 300,
    buttons: [
      {
        text: t("dataReport.run"),
        code: "run",
        props: { type: "success", link: true },
        onClick: ({ row, loading }) => deps.run(row as ReportItem, loading),
        index: 10,
        show: row => deps.canRun && row?.is_owner !== false
      },
      {
        text: t("dataReport.designer"),
        code: "design",
        props: { type: "primary", link: true },
        onClick: ({ row }) => deps.design(row as ReportItem),
        index: 15,
        show: row => deps.canEdit && row?.is_owner !== false
      },
      {
        text: t("dataReport.edit"),
        code: "edit",
        props: { type: "primary", link: true },
        onClick: ({ row }) => deps.openDialog(row as ReportItem),
        index: 20,
        show: row => deps.canEdit && row?.is_owner !== false
      }
    ]
  });

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("dataReport.create"),
        code: "create",
        props: { type: "primary" },
        onClick: () => deps.openDialog(null),
        show: deps.canCreate
      }
    ]
  });

  return { operationButtonsProps, tableBarButtonsProps };
}
