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
  useNoticeReadColumns: vi.fn(() => ({ listColumnsFormat: columnsFormat }))
}));

vi.mock("../noticeReadDetail", () => ({ openNoticeReadDetail: vi.fn() }));
vi.mock("../noticeReadRemove", () => ({
  createNoticeReadRemove: () => vi.fn()
}));

import { useNoticeReadColumns } from "../useNoticeReadColumns";
import { useNoticeRead } from "../hook";

describe("useNoticeRead 列接线", () => {
  it("列组合式函数在 setup 同步执行（不延迟到 columns 回调）", () => {
    const page = useNoticeRead();
    // useNoticeReadColumns 内部有 inject / onBeforeMount：延迟到列格式化回调
    // 才调用会脱离组件实例，必须在本 hook 同步执行
    expect(useNoticeReadColumns).toHaveBeenCalledTimes(1);
    expect(page.listColumnsFormat).toBeTypeOf("function");

    const column = { _column: { key: "notice_info" } };
    const result = page.listColumnsFormat!([column as never]);
    expect(columnsFormat).toHaveBeenCalledWith([column]);
    expect(result[0].cellRenderer).toBeTypeOf("function");
  });
});
