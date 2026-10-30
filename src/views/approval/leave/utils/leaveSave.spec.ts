import { describe, expect, it, vi } from "vitest";
import { buildLeaveSaveRequest } from "./leaveSave";

/**
 * 编辑请假单必须走 partialUpdate(原 pk)：历史缺陷是编辑也调 create，
 * 改一次日期就多出一张重复请假单并立即提交审批。
 */
const makeApi = () => ({
  create: vi.fn((data: Record<string, unknown>) => ({ kind: "create", data })),
  partialUpdate: vi.fn(
    (pk: string | number, data: Record<string, unknown>) => ({
      kind: "update",
      pk,
      data
    })
  )
});

describe("buildLeaveSaveRequest", () => {
  it("编辑（isAdd=false）：按原 pk 走 partialUpdate，不新建", () => {
    const api = makeApi();

    const result = buildLeaveSaveRequest(api, { pk: 12, days: 2 }, false);

    expect(result).toMatchObject({ kind: "update", pk: 12 });
    expect(api.partialUpdate).toHaveBeenCalledWith(12, { pk: 12, days: 2 });
    expect(api.create).not.toHaveBeenCalled();
  });

  it("新增（isAdd=true / 缺省）：走 create", () => {
    const api = makeApi();

    buildLeaveSaveRequest(api, { days: 2 }, true);
    buildLeaveSaveRequest(api, { days: 2 }, undefined);

    expect(api.create).toHaveBeenCalledTimes(2);
    expect(api.partialUpdate).not.toHaveBeenCalled();
  });

  it("编辑但载荷缺主键：安全回退到 create（不产生 partialUpdate(undefined)）", () => {
    const api = makeApi();

    const result = buildLeaveSaveRequest(api, { days: 2 }, false);

    expect(result).toMatchObject({ kind: "create" });
    expect(api.partialUpdate).not.toHaveBeenCalled();
  });

  it("兼容 id 形态的主键", () => {
    const api = makeApi();

    buildLeaveSaveRequest(api, { id: 7 }, false);

    expect(api.partialUpdate).toHaveBeenCalledWith(7, { id: 7 });
  });
});
