import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import type {
  ButtonRowProps,
  OperationButtonsRow
} from "@/components/RePlusPage/src/components/ButtonOperation/src/types";
import type { ActionItem, TableActionAuth } from "./types";

/** 权限判断函数：返回 false 则隐藏对应 auth 的操作 */
export type PermissionResolver = (auth?: TableActionAuth) => boolean;

/**
 * 操作项是否可见：权限命中 + ifShow（布尔或函数）。
 * 与 vben `VbenTableAction` 的可见性口径一致；auth 存在时由 hasPermission 判定。
 */
export function checkActionVisible(
  item: ActionItem,
  hasPermission: PermissionResolver
): boolean {
  if (item.auth && !hasPermission(item.auth)) return false;
  if (typeof item.ifShow === "boolean") return item.ifShow;
  if (typeof item.ifShow === "function") return item.ifShow();
  return true;
}

/** 取 tooltip 文案（字符串或配置对象） */
export function tooltipContentOf(item: ActionItem): string | undefined {
  if (!item.tooltip) return undefined;
  return typeof item.tooltip === "string" ? item.tooltip : item.tooltip.content;
}

/**
 * 把通用操作项映射为操作按钮渲染器的行模型：
 * 复用 `OperationButton` 的渲染与图标约定（useRenderIcon / 确认框 / 下拉内兜底），
 * 仅在此处完成契约转换，不改动 `RePlusPage` 内部既有实现。
 *
 * @param confirmTitle 确认型操作缺省标题（popConfirm 未给 title 时兜底）
 */
export function toOperationRow(
  item: ActionItem,
  index: number,
  hasPermission: PermissionResolver,
  confirmTitle?: string
): OperationButtonsRow {
  const rowProps: ButtonRowProps = {
    link: true,
    type: item.danger ? "danger" : "primary"
  };
  if (item.icon) rowProps.icon = useRenderIcon(item.icon);
  if (item.disabled !== undefined) rowProps.disabled = item.disabled;
  if (item.loading !== undefined) rowProps.loading = item.loading;
  if (item.size) rowProps.size = item.size;
  if (item.class) rowProps.class = item.class;

  const tooltip = tooltipContentOf(item);
  // icon-only 按钮的可访问名（a11y）：无 text 时取 tooltip 文案
  if (!item.text && tooltip && !rowProps["aria-label"]) {
    rowProps["aria-label"] = tooltip;
  }

  return {
    code: item.key ?? `action-${index}`,
    text: item.text,
    index,
    props: rowProps,
    show: () => checkActionVisible(item, hasPermission),
    tooltip: tooltip ? { content: tooltip } : undefined,
    confirm: item.popConfirm
      ? toConfirm(item.popConfirm, confirmTitle)
      : undefined,
    onClick: params => {
      // 确认型操作优先走 popConfirm.confirm（对齐 vben 契约），否则回退 onClick
      if (item.popConfirm?.confirm) {
        item.popConfirm.confirm();
        return;
      }
      item.onClick?.({ row: params.row, item, loading: params.loading });
    }
  };
}

/** 气泡确认框配置 → 操作按钮行模型的 confirm 字段 */
function toConfirm(
  pc: NonNullable<ActionItem["popConfirm"]>,
  fallbackTitle?: string
) {
  const props: Record<string, unknown> = {};
  if (pc.okText) props.confirmButtonText = pc.okText;
  if (pc.cancelText) props.cancelButtonText = pc.cancelText;
  return {
    title: pc.title ?? fallbackTitle,
    ...(Object.keys(props).length ? { props } : {})
  };
}
