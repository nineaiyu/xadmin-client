import { useViewedRow } from "@/hooks/useViewedRow";
import type { OperationButtonsRow } from "../components/ButtonOperation";
import type { RePlusPageProps } from "./types";

/**
 * 自定义按钮包装：点击后同样标记该行已读（口径：与行交互即视为看过）。
 *
 * 默认按钮的标记在 plusPageOperationButtons 内完成；页面自定义
 * `operationButtonsProps.buttons`（如自绘 detail 覆盖默认详情）走本包装，
 * 保证「操作列任何入口」都命中已读标记。
 */
function wrapButtons(
  buttons: OperationButtonsRow[],
  onRowAction: (row: Record<string, unknown>) => void
): OperationButtonsRow[] {
  return buttons.map(button => {
    const original = button.onClick;
    if (!original) return button;
    return {
      ...button,
      onClick: params => {
        onRowAction(params.row as Record<string, unknown>);
        original(params);
      }
    };
  });
}

/**
 * 表格已读行接线（RePlusPage）：按接口路径建作用域（跨环境稳定且同页多表天然隔离；
 * api 未声明 baseApi 的页面回退统一作用域），产出「行类绑定」与「操作标记回调」。
 *
 * 未开启（`viewedRow` 缺省 / false）时不创建状态、两处绑定均为 undefined——零开销零回归。
 */
export function useViewedRowBinding(props: RePlusPageProps) {
  const config = props.viewedRow;
  const state = config
    ? useViewedRow({
        scope: props.api?.baseApi || "re-plus-page",
        ...(typeof config === "object" ? config : {})
      })
    : null;
  const keyField = (typeof config === "object" && config.keyField) || "pk";

  /** 操作列「详情 / 编辑」命中时标记该行已读 */
  const onRowAction = (row: Record<string, unknown>) => {
    const key = row?.[keyField];
    if (key === undefined || key === null || key === "") return;
    state?.markAsViewed(key as string | number);
  };

  const passthrough = (buttons: OperationButtonsRow[]) => buttons;

  return {
    /** el-table `row-class-name` 绑定（未开启为 undefined，不绑定） */
    rowClassName: state?.getRowClassName,
    /** 操作按钮的行命中回调（未开启为 undefined，零开销） */
    onRowAction: state ? onRowAction : undefined,
    /** 自定义按钮包装（未开启时恒等返回） */
    wrapButtons: state
      ? (buttons: OperationButtonsRow[]) => wrapButtons(buttons, onRowAction)
      : passthrough
  };
}
