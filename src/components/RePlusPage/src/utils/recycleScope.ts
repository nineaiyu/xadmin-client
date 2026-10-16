/**
 * 回收站单元格渲染作用域构建。
 *
 * 回收站抽屉复用主列表的 `cellRenderer`（列定义由 RePlusPage 透传），但表格容器
 * 是 ReRecycleBin 自己的 el-table，作用域需要按框架渲染器的约定补齐：
 * - `props.size`：操作列 slot 的尺寸位（el-switch / el-tag 读它）；
 * - `column`：开关等渲染器读 `scope.column.label` 生成可访问名/操作提示文案，
 *   缺省会让渲染函数抛错、整个表体渲染中断（表现为「分页显示共 N 条、一行都不渲染」）；
 * - `readonly`：回收站里的行已软删除，渲染器据此把交互控件置灰（见 handle.tsx）。
 */

export interface RecycleCellScopeOptions {
  row: Record<string, unknown>;
  /** 列表列对象（label 供渲染器生成可访问名，未配置时归一为空串） */
  column: { label?: string };
  index: number;
}

export interface RecycleCellScope {
  row: Record<string, unknown>;
  column: { label: string };
  index: number;
  size: "default";
  props: { size: "default" };
  readonly: true;
}

export function buildRecycleCellScope(
  options: RecycleCellScopeOptions
): RecycleCellScope {
  return {
    row: options.row,
    column: { label: options.column.label ?? "" },
    index: options.index,
    size: "default",
    props: { size: "default" },
    readonly: true
  };
}
