import { flushPromises, mount } from "@vue/test-utils";
import type { TableColumnRenderer } from "@pureadmin/table";
import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import type { RecordType } from "plus-pro-components";

const mocks = vi.hoisted(() => ({
  retrieve: vi.fn(),
  message: vi.fn(),
  openApprovalProgressDialog: vi.fn()
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/router/utils", () => ({ usePageAuth: () => ({}) }));
vi.mock("@/api/approval/approval", () => ({
  approvalApi: { retrieve: mocks.retrieve }
}));
vi.mock("@/components/RePlusPage", () => ({
  // 与真实实现同口径：按 _column.key 分派列处理器（进度弹窗入口挂在 approver 列）
  formatPageColumns: (
    cols: Array<Record<string, unknown>>,
    handlers: Record<string, (column: unknown) => void>
  ) => {
    cols.forEach(column => {
      const key = (column._column as { key?: string } | undefined)?.key;
      const handler = typeof key === "string" ? handlers[key] : undefined;
      handler?.(column);
    });
    return cols;
  }
}));
vi.mock("@/utils/dict", () => ({ statusTagProps: () => ({}) }));
vi.mock("@/utils/message", () => ({ message: mocks.message }));
vi.mock("@/utils/approvalBadge", () => ({ refreshApprovalBadge: vi.fn() }));
vi.mock("@/utils/approvalStats", () => ({ refreshApprovalStats: vi.fn() }));
vi.mock("../dialogs", () => ({
  openApprovalProgressDialog: mocks.openApprovalProgressDialog
}));
vi.mock("../useApprovalRowActions", () => ({
  useApprovalRowActions: () => ({ operationButtonsProps: [] })
}));
vi.mock("../useApprovalToolbar", () => ({
  useApprovalToolbar: () => ({ tableBarButtonsProps: [] })
}));

import { useApprovalPanel } from "../hook";

/** 经 approver 列的链接渲染触发 openProgress（该函数不直接导出，随列装配闭包生效） */
const clickApproverLink = async (row: RecordType) => {
  const tableRef = ref();
  const { listColumnsFormat } = useApprovalPanel("pending", tableRef);
  const [column] = listColumnsFormat([{ _column: { key: "approver" } }]);
  const vnode = column!.cellRenderer!({
    row,
    index: 0,
    props: {},
    attrs: {},
    column: {},
    $index: 0
  } as TableColumnRenderer);
  const wrapper = mount({ render: () => vnode });
  await wrapper.find(".el-link").trigger("click");
  await flushPromises();
};

describe("审批进度弹窗详情拉取失败提示", () => {
  it("业务码非成功时提示且不打开弹窗", async () => {
    mocks.retrieve.mockResolvedValue({ code: 500, data: null });
    await clickApproverLink({ pk: "req-1" });

    expect(mocks.message).toHaveBeenCalledWith("approval.progressLoadFailed", {
      type: "warning"
    });
    expect(mocks.openApprovalProgressDialog).not.toHaveBeenCalled();
  });

  it("网络异常（promise 拒绝）时提示且不产生未处理拒绝", async () => {
    mocks.retrieve.mockRejectedValue(new Error("network down"));
    await clickApproverLink({ pk: "req-2" });

    expect(mocks.message).toHaveBeenCalledWith("approval.progressLoadFailed", {
      type: "warning"
    });
    expect(mocks.openApprovalProgressDialog).not.toHaveBeenCalled();
  });

  it("成功时仍正常打开进度弹窗", async () => {
    mocks.retrieve.mockResolvedValue({
      code: 1000,
      data: { steps: [{ order: 1 }] }
    });
    await clickApproverLink({ pk: "req-3" });

    expect(mocks.message).not.toHaveBeenCalled();
    expect(mocks.openApprovalProgressDialog).toHaveBeenCalledWith(
      expect.objectContaining({ no: "REQ-3" })
    );
  });
});
