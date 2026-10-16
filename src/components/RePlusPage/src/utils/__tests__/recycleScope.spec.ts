import { describe, expect, it } from "vitest";

import { buildRecycleCellScope } from "../recycleScope";

/**
 * 回收站单元格作用域守护。
 *
 * 背景：框架渲染器（el-switch 等）会读 `scope.column.label` 生成可访问名 /
 * 操作提示，而回收站抽屉是自建 el-table，作用域由本函数拼装。曾因漏传 `column`
 * 让渲染函数抛「Cannot read properties of undefined (reading 'label')」，
 * 整个表体渲染中断：分页正确显示「共 N 条」但一行都不渲染（用户回收站 / 角色
 * 回收站两个 E2E 用例同时挂掉）。
 */
describe("buildRecycleCellScope", () => {
  const row = { pk: 1, is_active: true };

  it("透传 column（渲染器读 label 生成可访问名）", () => {
    const scope = buildRecycleCellScope({
      row,
      column: { label: "有效" },
      index: 3
    });
    expect(scope.column.label).toBe("有效");
    expect(scope.index).toBe(3);
    expect(scope.row).toBe(row);
  });

  it("补齐渲染器约定的 size / props（el-switch 与 el-tag 读 props.size）", () => {
    const scope = buildRecycleCellScope({
      row,
      column: { label: "有效" },
      index: 0
    });
    expect(scope.size).toBe("default");
    expect(scope.props.size).toBe("default");
  });

  it("只读标记置位（软删除行不得渲染可变更控件）", () => {
    const scope = buildRecycleCellScope({
      row,
      column: { label: "有效" },
      index: 0
    });
    expect(scope.readonly).toBe(true);
  });
});
