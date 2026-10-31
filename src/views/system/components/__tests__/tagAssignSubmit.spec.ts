import { beforeEach, describe, expect, it, vi } from "vitest";

const { batchAssignMock, messageMock } = vi.hoisted(() => ({
  batchAssignMock: vi.fn(),
  messageMock: vi.fn()
}));

vi.mock("@/api/system/tag", () => ({
  tagApi: {
    batchAssign: (...args: unknown[]) => batchAssignMock(...args)
  }
}));

vi.mock("@/utils/message", () => ({ message: messageMock }));

import { submitTagBatchAssign } from "../tagAssignSubmit";

const t = ((key: string, params?: Record<string, unknown>) =>
  params ? `${key}:${JSON.stringify(params)}` : key) as never;

describe("submitTagBatchAssign", () => {
  beforeEach(() => {
    batchAssignMock.mockReset();
    messageMock.mockReset();
  });

  it("从 data 层读取逐对象结果（读顶层会让成功数恒为 0）", async () => {
    batchAssignMock.mockResolvedValue({
      code: 1000,
      detail: "",
      data: { success: ["1", "2"], failures: [{ pk: "3", reason: "x" }] }
    });
    const done = vi.fn();
    const tableRef = { value: { handleGetData: vi.fn() } };

    await submitTagBatchAssign({
      t,
      tableRef: tableRef as never,
      resource: "identity.userinfo",
      pks: ["1", "2", "3"],
      tags: ["tag-1"],
      mode: "add",
      done,
      closeLoading: vi.fn()
    });

    expect(messageMock).toHaveBeenCalledWith(
      expect.stringContaining('"success":2'),
      { type: "warning" }
    );
    expect(done).toHaveBeenCalled();
    expect(tableRef.value.handleGetData).toHaveBeenCalled();
  });
});
