import { isVNode, ref, type VNode } from "vue";
import { describe, expect, it, vi } from "vitest";
import { ElTag } from "element-plus";

/**
 * 通知接收列表列渲染单测。
 *
 * 核心回归：
 * - 公告族行不再渲染「已读/未读」开关（后端 state 对公告族是删除）；
 * - 标题点击打开行内详情弹窗，不再跨页 push 一个落不到详情的 pk。
 */

const { openDetailMock, switchMock } = vi.hoisted(() => ({
  openDetailMock: vi.fn(),
  switchMock: vi.fn(() => "SWITCH")
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn() })
}));
vi.mock("@/views/system/hooks", () => ({ goUserDetail: vi.fn() }));
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
  renderSwitch: () => switchMock,
  usePublicHooks: () => ({ switchStyle: {} })
}));
vi.mock("../noticeReadDetail", () => ({
  openNoticeReadDetail: openDetailMock
}));

import type { PageTableColumn } from "@/components/RePlusPage";
import { useNoticeReadColumns } from "../useNoticeReadColumns";

const t = (key: string) => key;

function buildColumns(): PageTableColumn[] {
  return [
    { _column: { key: "notice_info" }, prop: "notice_info" },
    { _column: { key: "unread" }, prop: "unread" }
  ];
}

function format(): PageTableColumn[] {
  const { listColumnsFormat } = useNoticeReadColumns({
    t,
    api: { state: vi.fn() } as never,
    auth: { state: true },
    tableRef: ref()
  });
  return listColumnsFormat(buildColumns());
}

/** cellRenderer 的 scope 参数由表格运行时提供，这里按最小可用形态反射调用 */
function render(
  column: PageTableColumn,
  row: Record<string, unknown>
): VNode | string {
  return Reflect.apply(column.cellRenderer!, undefined, [
    { row, index: 0, props: {}, attrs: {}, column: {}, $index: 0 }
  ]);
}

describe("通知接收列渲染", () => {
  it("公告族行：已读列渲染只读标签，不渲染可回写开关", () => {
    const vnode = render(format()[1], {
      unread: false,
      notice_info: { pk: 1, notice_type: { value: 1, label: "公告" } }
    });

    expect(isVNode(vnode)).toBe(true);
    const tag = vnode as VNode;
    expect(tag.type).toBe(ElTag);
    expect((tag.children as { default: () => string }).default()).toBe(
      "labels.read"
    );
  });

  it("用户族行：保留已读/未读开关", () => {
    const result = render(format()[1], {
      unread: true,
      notice_info: { pk: 2, notice_type: { value: 2, label: "用户通知" } }
    });

    expect(result).toBe("SWITCH");
  });

  it("标题点击打开行内详情弹窗（不再跨页跳转）", () => {
    const row = {
      notice_info: {
        pk: 9,
        title: "公告标题",
        notice_type: { value: 1, label: "公告" },
        level: { value: "info" }
      }
    };
    const vnode = render(format()[0], row);

    expect(isVNode(vnode)).toBe(true);
    (vnode as VNode).props?.onClick();

    expect(openDetailMock).toHaveBeenCalledTimes(1);
    expect(openDetailMock.mock.calls[0][0].row).toBe(row);
  });
});
