/**
 * 表格可访问名称（a11y，单源）。
 *
 * 背景：Element Plus 的 `el-table` 渲染出「表头」「表体」两张原生 `<table>`，
 * 二者都没有 caption / aria-label，读屏逐格浏览时无法获知当前处于哪张表；
 * 组件也未提供对应 props。这里在渲染后把名称（与 caption 等价的 aria-label，
 * 且不占表格盒空间）写到两张原生表上，并在存在说明节点时建立 aria-describedby
 * 关联（「表格 ↔ 说明」的绑定）。
 *
 * 分页器的「每页条数」下拉同属该收口面：EP `el-pagination` 内部渲染的
 * `el-select` 没有可访问名入口（框架未提供 props），同样在渲染后补 aria-label。
 *
 * 幂等：重复调用只覆盖同名属性，不新增节点；调用时机 = 挂载后与数据/列变化后。
 */

/** 说明节点标记：带该属性的元素会作为表格的 aria-describedby 目标 */
export const TABLE_A11Y_DESC_ATTR = "data-table-a11y-desc";

/** 兜底说明节点 id（页面未给 id 时由本函数补） */
const FALLBACK_DESC_ID = "re-table-a11y-desc";

/** 同步表格可访问名与说明关联；返回被命中的原生表数量（便于测试断言） */
export function syncTableA11y(
  root: HTMLElement | null | undefined,
  label: string
): number {
  if (!root) return 0;
  const tables = root.querySelectorAll<HTMLTableElement>(
    "table.el-table__header, table.el-table__body"
  );
  if (tables.length === 0) return 0;

  const desc = root.querySelector<HTMLElement>(`[${TABLE_A11Y_DESC_ATTR}]`);
  const descId = desc ? desc.id || FALLBACK_DESC_ID : "";

  tables.forEach(table => {
    if (label && table.getAttribute("aria-label") !== label) {
      table.setAttribute("aria-label", label);
    }
    if (descId) {
      if (!desc!.id) desc!.id = descId;
      if (table.getAttribute("aria-describedby") !== descId) {
        table.setAttribute("aria-describedby", descId);
      }
    } else if (table.hasAttribute("aria-describedby")) {
      table.removeAttribute("aria-describedby");
    }
  });

  return tables.length;
}

/** 同步分页器「每页条数」下拉的可访问名；返回被命中的输入框数量（便于测试断言） */
export function syncPaginationA11y(
  root: HTMLElement | null | undefined,
  label: string
): number {
  if (!root || !label) return 0;
  const inputs = root.querySelectorAll<HTMLInputElement>(
    ".el-pagination .el-select__input"
  );
  inputs.forEach(input => {
    if (input.getAttribute("aria-label") !== label) {
      input.setAttribute("aria-label", label);
    }
  });
  return inputs.length;
}
