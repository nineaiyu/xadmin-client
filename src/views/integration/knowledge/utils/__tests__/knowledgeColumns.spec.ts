import { ElLink } from "element-plus";
import { describe, expect, it, vi } from "vitest";
import type { PageTableColumn } from "@/components/RePlusPage";
import { useKnowledgeColumns } from "../useKnowledgeColumns";

const t = ((key: string) => key) as never;

type Rendering = { type: unknown; props: { onClick: () => void } };
type Renderer = (ctx: { row: unknown; props: unknown }) => unknown;

const titleColumns = (): PageTableColumn[] => [
  { _column: { key: "title" } } as PageTableColumn
];

const rendererOf = (
  listColumnsFormat: ReturnType<typeof useKnowledgeColumns>["listColumnsFormat"]
): Renderer => {
  const [column] = listColumnsFormat(titleColumns());
  return column.cellRenderer as Renderer;
};

describe("知识库标题入口", () => {
  it("无 retrieve 权限时标题为纯文本，不可打开抽屉", () => {
    const open = vi.fn();
    const { listColumnsFormat } = useKnowledgeColumns({
      t,
      openKnowledgePanel: open,
      canRetrieve: false
    });
    const rendered = rendererOf(listColumnsFormat)({
      row: { title: "文档 A" },
      props: {}
    });

    expect(rendered).toBe("文档 A");
    expect(open).not.toHaveBeenCalled();
  });

  it("有 retrieve 权限时标题为抽屉链接", () => {
    const open = vi.fn();
    const { listColumnsFormat } = useKnowledgeColumns({
      t,
      openKnowledgePanel: open,
      canRetrieve: true
    });
    const row = { title: "文档 A" };
    const rendered = rendererOf(listColumnsFormat)({
      row,
      props: {}
    }) as Rendering;

    expect(rendered.type).toBe(ElLink);
    rendered.props.onClick();
    expect(open).toHaveBeenCalledWith(row);
  });
});
