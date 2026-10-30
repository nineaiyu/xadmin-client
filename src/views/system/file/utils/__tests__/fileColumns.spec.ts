import { isVNode, type VNode } from "vue";
import { describe, expect, it, vi } from "vitest";
import { ElButton, ElLink } from "element-plus";

/**
 * 文件中心列渲染单测。
 *
 * 核心回归：上传文件的 `access_url` 不再渲染 `/media/` 直链，
 * 而是复用受鉴权、记访问审计的下载动作；外链登记行才保留直接打开。
 */

vi.mock("@/components/RePlusPage", () => ({
  formatPageColumns: (
    columns: Array<Record<string, unknown>>,
    handlers: Record<string, (column: Record<string, unknown>) => void>
  ) => {
    columns.forEach(column => {
      const key = (column._column as { key?: string } | undefined)?.key;
      if (key) handlers[key]?.(column);
    });
    return columns;
  },
  isReadonlyCell: (scope: { readonly?: boolean }) => scope?.readonly === true,
  renderBooleanTag: () => vi.fn(),
  renderTagsCell: vi.fn()
}));
vi.mock("@/utils/tagTone", () => ({ renderTagsCell: vi.fn() }));
vi.mock("../components/previewDrawer", () => ({ openPreviewDrawer: vi.fn() }));

import type { PageTableColumn } from "@/components/RePlusPage";
import { buildFileColumns } from "../fileColumns";

const t = (key: string) => key;

function buildColumns(
  overrides: {
    canDownload?: boolean;
    onDownload?: (row: Record<string, unknown>) => void;
  } = {}
): PageTableColumn[] {
  const { listColumnsFormat } = buildFileColumns({
    t,
    tagStyle: {} as never,
    canPreview: true,
    canDownload: overrides.canDownload ?? true,
    onDownload: overrides.onDownload
  });
  return listColumnsFormat([
    { _column: { key: "access_url" }, prop: "access_url" }
  ]);
}

/** cellRenderer 的 scope 参数由表格运行时提供，这里按最小可用形态反射调用 */
function render(
  column: PageTableColumn,
  row: Record<string, unknown>,
  readonly = false
): VNode | string {
  return Reflect.apply(column.cellRenderer!, undefined, [
    { row, readonly, index: 0, props: {}, attrs: {}, column: {}, $index: 0 }
  ]);
}

describe("文件中心 access_url 列", () => {
  it("上传文件：渲染受鉴权下载按钮，不再暴露 /media/ 直链", () => {
    const onDownload = vi.fn();
    const row = {
      pk: 7,
      filename: "a.txt",
      is_upload: true,
      access_url: "/media/upload/a.txt"
    };
    const vnode = render(buildColumns({ onDownload })[0], row);

    expect(isVNode(vnode)).toBe(true);
    const button = vnode as VNode;
    expect(button.type).toBe(ElButton);
    expect(button.props?.href).toBeUndefined();
    (button.props?.onClick as () => void)();
    expect(onDownload).toHaveBeenCalledWith(row);
  });

  it("外链登记行：保留直接打开（地址本身在外部）", () => {
    const vnode = render(buildColumns()[0], {
      pk: 8,
      is_upload: false,
      access_url: "https://example.com/a.pdf"
    });

    expect(isVNode(vnode)).toBe(true);
    const link = vnode as VNode;
    expect(link.type).toBe(ElLink);
    expect(link.props?.href).toBe("https://example.com/a.pdf");
  });

  it("无下载权限：上传文件降级为占位，不提供可点入口", () => {
    const vnode = render(buildColumns({ canDownload: false })[0], {
      pk: 9,
      is_upload: true,
      access_url: "/media/upload/b.txt"
    });

    expect(isVNode(vnode)).toBe(true);
    expect((vnode as VNode).type).toBe("span");
    expect((vnode as VNode).children).toBe("-");
  });

  it("回收站只读：保留纯文本地址，不提供下载入口", () => {
    const vnode = render(
      buildColumns()[0],
      { pk: 10, is_upload: true, access_url: "/media/upload/c.txt" },
      true
    );

    expect(isVNode(vnode)).toBe(true);
    expect((vnode as VNode).type).toBe("span");
    expect((vnode as VNode).children).toBe("/media/upload/c.txt");
  });
});
