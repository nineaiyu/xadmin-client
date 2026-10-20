import { describe, expect, it } from "vitest";

import { builtinFormRenderers } from "../renderers-form";
import type { PageColumn, PlusColumnContext } from "../types";

/** 构造 datetime 列的元数据上下文（列表列复用表单渲染器下发的 width） */
const buildColumn = () => {
  const column = {
    key: "created_time",
    label: "创建时间",
    input_type: "datetime",
    read_only: true
  };
  const item = {
    _column: column,
    prop: column.key,
    label: column.label,
    fieldProps: {}
  } as unknown as PageColumn;
  return { item, column, context: { column } as unknown as PlusColumnContext };
};

describe("datetime 列宽", () => {
  it("列表时间列宽度能完整容纳 YYYY-MM-DD HH:mm:ss", () => {
    const { item, context } = buildColumn();

    builtinFormRenderers.datetime(item, context);

    // 19 字符 + 单元格两侧内边距实测约 156px；180 留出字体/缩放余量。
    // 此前 160 在部分字体下会把「创建时间 / 更新时间」截成省略号。
    expect(item.width).toBeGreaterThanOrEqual(180);
  });
});
