import { shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import type { OperationProps } from "@/components/RePlusPage";
import type { ScreenItem } from "@/api/dataset/analysis";

/**
 * 大屏页操作区按钮（自 hook.tsx 抽出，行数门禁）：行内「投屏 / 设计器 /
 * 远程控制」；新建与编辑由框架元数据表单入口提供，不再自定义。
 *
 * 非创建者行隐藏设计器（保存会被后端守卫拒绝）；投屏保留原交互（跳独立全屏页）。
 */
export function useScreenButtons(deps: {
  canEdit: boolean;
  canCommand: boolean;
  display: (row: ScreenItem) => void;
  design: (row: ScreenItem) => void;
  openControl: (row: ScreenItem) => void;
}) {
  const { t } = useI18n();

  const operationButtonsProps = shallowRef<OperationProps>({
    // 6 个按钮（编辑/删除/详情 + 投屏/设计器/远程控制）全部内联：任一被折叠
    // 都会使既有操作路径多点一次；列宽由 RePlusPage 按容器宽度对齐收敛
    showNumber: 6,
    width: 360,
    buttons: [
      {
        text: t("dataScreen.display"),
        code: "display",
        props: { type: "success", link: true },
        onClick: ({ row }) => deps.display(row as ScreenItem),
        index: 10,
        show: true
      },
      {
        text: t("dataScreen.designer"),
        code: "design",
        props: { type: "primary", link: true },
        onClick: ({ row }) => deps.design(row as ScreenItem),
        // 非创建者行不显示设计器（保存会被后端守卫拒绝）
        index: 6,
        show: row => deps.canEdit && row?.is_owner !== false
      },
      {
        text: t("dataScreen.remoteControl"),
        code: "command",
        props: { type: "warning", link: true },
        onClick: ({ row }) => deps.openControl(row as ScreenItem),
        index: 15,
        show: deps.canCommand
      }
    ]
  });

  return { operationButtonsProps };
}
