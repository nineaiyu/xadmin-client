/**
 * 操作列「内容实测宽度」（浏览器环境）。
 *
 * 为什么需要：操作列宽度是页面配置的固定值，而列内按钮受权限点与行数据影响
 * （`show` 为假即不渲染）。未授予「编辑 / 删除」的用户只看到一个按钮，却仍占着
 * 为三个按钮预留的列宽，右侧大片空白。
 *
 * 为什么用「探测容器」而不是直接量单元格：
 * 1. 表格是 `table-layout: fixed`（列宽固定），内容超出会折行——直接量单元格
 *    只能得到折行后的最宽一行，得不到「不折行需要多宽」；
 * 2. 直接量当前单元格宽度会自我反馈（列越窄 → 量到越窄），造成持续收缩。
 * 因此把内容克隆进 `width: max-content` 的探测容器（表头与数据行各取一份，
 * 按 innerHTML 去重）量一次，得到与列宽无关的自然宽度，再加单元格内边距即
 * 所需列宽；探测容器同步创建与移除，不留在页面上。
 */

/** 探测容器的排查用标记（正常流程瞬时存在） */
const PROBE_ATTRIBUTE = "data-re-plus-operation-probe";

/** 表体数据行（树形子行同样是 .el-table__row，一并纳入实测，取最大者） */
const BODY_ROW_SELECTOR = ".el-table__body-wrapper .el-table__row";

/** 表头行（「操作」表头文案同样不能裁切，是列宽下限的一部分） */
const HEADER_ROW_SELECTOR = ".el-table__header-wrapper thead tr";

/**
 * 实测操作列内容所需宽度（含单元格内边距）。
 *
 * @param root RePlusPage 根节点
 * @returns 所需列宽（px）；下列情形返回 0，调用方按页面配置宽度渲染：
 *          - 非浏览器环境 / 根节点未就绪；
 *          - 表体没有数据行（空表只量到表头，据此收窄会让下一屏数据溢出）；
 *          - 单元格未渲染出内容。
 */
export function measureOperationContentWidth(
  root: HTMLElement | undefined | null
): number {
  if (!root || typeof document === "undefined") return 0;
  const rows = Array.from(
    root.querySelectorAll<HTMLElement>(BODY_ROW_SELECTOR)
  );
  if (!rows.length) return 0;

  const cells: HTMLElement[] = [];
  const headerCell = lastCellContent(root.querySelector(HEADER_ROW_SELECTOR));
  if (headerCell) cells.push(headerCell);
  rows.forEach(row => {
    const cell = lastCellContent(row);
    if (cell) cells.push(cell);
  });
  // 单元格由列组件注册后才渲染：拿不到内容容器时视为「表格未就绪」（调用方有限重试）
  if (!cells.length) return 0;

  return Math.ceil(measureCellsWidth(cells));
}

/** 行（含表头行）最后一列的单元格内容容器（操作列恒为最后一列） */
function lastCellContent(row: Element | null | undefined): HTMLElement | null {
  const cell = row?.lastElementChild;
  const content = cell?.firstElementChild;
  if (!content || !content.classList.contains("cell")) return null;
  return content as HTMLElement;
}

/**
 * 用探测容器量出一批单元格内容的自然宽度，返回其中最大者（含内边距）。
 *
 * 去重：同一页的行通常渲染同一组按钮，按「内边距 + innerHTML」去重后
 * 只克隆一次（一页最多克隆出几个探测节点）。
 */
function measureCellsWidth(cells: HTMLElement[]): number {
  const holder = document.createElement("div");
  holder.setAttribute(PROBE_ATTRIBUTE, "");
  holder.style.cssText =
    "position:absolute;left:-100000px;top:0;visibility:hidden;pointer-events:none;";
  const stack = document.createElement("div");
  // 列方向排布 + 各项取自然宽度：容器宽度即最宽一项
  stack.style.cssText =
    "display:flex;flex-direction:column;align-items:flex-start;width:max-content;";

  const seen = new Set<string>();
  const probes: HTMLElement[] = [];
  for (const cell of cells) {
    const style = getComputedStyle(cell);
    const key = `${style.paddingLeft}|${style.paddingRight}|${cell.innerHTML}`;
    if (seen.has(key)) continue;
    if (!cell.textContent?.trim() && !cell.children.length) continue;
    seen.add(key);
    const probe = document.createElement("div");
    // 字体取单元格计算值（表体字号受 --el-font-size-base 影响）；内边距直接算进
    // 探测宽度，量出来即「所需列宽」
    probe.style.cssText =
      `width:max-content;white-space:nowrap;` +
      `font-family:${style.fontFamily};font-size:${style.fontSize};` +
      `font-weight:${style.fontWeight};line-height:${style.lineHeight};` +
      `padding-left:${style.paddingLeft};padding-right:${style.paddingRight};`;
    probe.innerHTML = cell.innerHTML;
    stack.appendChild(probe);
    probes.push(probe);
  }
  if (!probes.length) return 0;

  holder.appendChild(stack);
  document.body.appendChild(holder);
  try {
    return probes.reduce(
      (max, probe) => Math.max(max, probe.getBoundingClientRect().width),
      0
    );
  } finally {
    holder.remove();
  }
}
