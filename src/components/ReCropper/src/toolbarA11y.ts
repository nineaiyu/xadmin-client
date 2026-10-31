/**
 * 工具栏图标的键盘 / 读屏入口。
 *
 * 图标组件本身不可聚焦，直接渲染时名称只来自鼠标悬停提示；这里把动作包成
 * `role=button + tabindex + aria-label + Enter/Space` 的等价属性。
 */
export function cropperActionProps(
  label: string,
  activate?: (event: KeyboardEvent) => void
) {
  return {
    role: "button",
    tabindex: 0,
    "aria-label": label,
    onKeydown: (event: KeyboardEvent) => {
      if (!activate) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate(event);
      }
    }
  };
}
