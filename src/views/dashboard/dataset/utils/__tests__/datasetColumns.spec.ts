import { ElLink } from "element-plus";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  hasAuth: vi.fn((_code: string) => true),
  push: vi.fn()
}));

vi.mock("@/router/utils", () => ({ hasAuth: state.hasAuth }));
vi.mock("vue-router", async importOriginal => {
  const actual = await importOriginal<typeof import("vue-router")>();
  return { ...actual, useRouter: () => ({ push: state.push }) };
});

import type { PageTableColumn } from "@/components/RePlusPage";
import { useDatasetColumns } from "../datasetColumns";

const t = ((key: string) => key) as never;

type Renderer = (ctx: { row: unknown; props: unknown }) => unknown;

const reportRenderer = () => {
  const { listColumnsFormat } = useDatasetColumns({ t });
  const [column] = listColumnsFormat([
    { _column: { key: "report_count" } } as PageTableColumn
  ]);
  return column.cellRenderer as Renderer;
};

describe("数据集报表数跳转", () => {
  it("无 list:DataReport 权限时渲染纯文本，不跳转", () => {
    state.hasAuth.mockImplementation(code => code !== "list:DataReport");
    const rendered = reportRenderer()({
      row: { pk: 7, report_count: 3 },
      props: {}
    });

    expect(rendered).toBe("3");
    expect(state.push).not.toHaveBeenCalled();
  });

  it("有权限时渲染链接并跳转报表页", () => {
    state.hasAuth.mockReturnValue(true);
    const rendered = reportRenderer()({
      row: { pk: 7, report_count: 3 },
      props: {}
    }) as { type: unknown; props: { onClick: () => void } };

    expect(rendered.type).toBe(ElLink);
    rendered.props.onClick();
    expect(state.push).toHaveBeenCalledWith({
      path: "/analysis/report/index",
      query: { dataset: "7" }
    });
  });
});
