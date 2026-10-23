import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";

const { columnsFormat } = vi.hoisted(() => ({
  columnsFormat: vi.fn((columns: unknown[]) =>
    columns.map(column => ({
      ...(column as object),
      cellRenderer: () => "title"
    }))
  )
}));

vi.mock("@/components/RePlusPage", () => ({
  defineListPage: (options: {
    columns?: (ctx: Record<string, unknown>) => unknown;
    buttons?: (ctx: Record<string, unknown>) => Record<string, unknown>;
  }) => {
    const ctx = {
      t: (key: string) => key,
      locale: "zh",
      api: {},
      auth: {},
      tableRef: ref()
    };
    return {
      ...ctx,
      listColumnsFormat: options.columns
        ? (columns: unknown[]) => options.columns!({ ...ctx, columns })
        : undefined,
      ...(options.buttons?.(ctx) ?? {})
    };
  },
  handleOperation: vi.fn()
}));

vi.mock("@/api/system/notice", () => ({
  noticeReadApi: { state: vi.fn(), allRead: vi.fn() }
}));

vi.mock("../useNoticeReadColumns", () => ({
  useNoticeReadColumns: () => ({ listColumnsFormat: columnsFormat })
}));

vi.mock("../noticeReadDetail", () => ({ openNoticeReadDetail: vi.fn() }));
vi.mock("../noticeReadRemove", () => ({
  createNoticeReadRemove: () => vi.fn()
}));

import { useNoticeRead } from "../hook";

describe("useNoticeRead 列接线", () => {
  it("listColumnsFormat 透传到页面（防止 notice_info 退回 JSON 渲染）", () => {
    const page = useNoticeRead();
    expect(page.listColumnsFormat).toBeTypeOf("function");

    const column = { _column: { key: "notice_info" } };
    const result = page.listColumnsFormat!([column as never]);
    expect(columnsFormat).toHaveBeenCalledWith([column]);
    expect(result[0].cellRenderer).toBeTypeOf("function");
  });
});
