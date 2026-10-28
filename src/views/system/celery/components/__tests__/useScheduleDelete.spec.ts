import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

vi.mock("@/utils/message", () => ({ message: vi.fn() }));

const confirmMock = vi.fn().mockResolvedValue(true);
vi.mock("@/hooks/useConfirm", () => ({ useConfirm: () => confirmMock }));

const showReferences = vi.fn();
vi.mock("../scheduleReferences", () => ({
  createScheduleReferenceDialog: () => ({ show: showReferences })
}));

import { useScheduleDelete } from "../useScheduleDelete";

type Button = {
  code: string | number;
  show?: boolean | ((...args: unknown[]) => boolean);
  onClick: (scope: { row: unknown }) => unknown;
};

const makeApi = (overrides: Record<string, unknown> = {}) => ({
  destroy: vi.fn().mockResolvedValue({ code: 1000 }),
  references: vi.fn().mockResolvedValue({ code: 1000, data: { total: 0 } }),
  ...overrides
});

const build = (
  api: ReturnType<typeof makeApi>,
  auth: Record<string, boolean>
) =>
  useScheduleDelete({
    t: (key: string) => key,
    api,
    auth,
    tableRef: ref(),
    kind: "crontab"
  });

const getButton = (props: { value: unknown }) => {
  const buttons = (props.value as { buttons?: Button[] }).buttons ?? [];
  return buttons.find(item => item.code === "delete") as Button;
};

beforeEach(() => {
  confirmMock.mockClear();
  confirmMock.mockResolvedValue(true);
  showReferences.mockClear();
});

describe("useScheduleDelete 能力位收回（FE-STATE-P1-03）", () => {
  it("批量删除必须一并关闭：框架批删不经过「先查引用再确认」", () => {
    const auth = { destroy: true, batchDestroy: true };
    build(makeApi(), auth);

    expect(auth.destroy).toBe(false);
    expect(auth.batchDestroy).toBe(false);
  });

  it("行内删除按钮按初始能力位决定显隐（收回后仍保留单条删除入口）", () => {
    const granted = build(makeApi(), { destroy: true, batchDestroy: true });
    expect(getButton(granted.operationButtonsProps).show).toBe(true);

    const denied = build(makeApi(), { destroy: false, batchDestroy: false });
    expect(getButton(denied.operationButtonsProps).show).toBe(false);
  });
});

describe("useScheduleDelete 删除链路", () => {
  it("存在引用时只弹引用清单，不发删除请求", async () => {
    const api = makeApi({
      references: vi
        .fn()
        .mockResolvedValue({ code: 1000, data: { total: 2, results: [] } })
    });
    const { operationButtonsProps } = build(api, { destroy: true });

    await getButton(operationButtonsProps).onClick({ row: { pk: "s-1" } });

    expect(showReferences).toHaveBeenCalledWith(
      expect.objectContaining({ total: 2 }),
      "s-1"
    );
    expect(api.destroy).not.toHaveBeenCalled();
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it("无引用时二次确认后删除并刷新列表", async () => {
    const api = makeApi();
    const tableRef = ref({ handleGetData: vi.fn() });
    const { operationButtonsProps } = useScheduleDelete({
      t: (key: string) => key,
      api,
      auth: { destroy: true },
      tableRef,
      kind: "interval"
    });

    await getButton(operationButtonsProps).onClick({ row: { pk: "s-2" } });

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(api.destroy).toHaveBeenCalledWith("s-2");
  });

  it("取引用失败不阻断删除（后端仍 fail-closed 拒绝并回传清单）", async () => {
    const api = makeApi({
      references: vi.fn().mockRejectedValue(new Error("403")),
      destroy: vi.fn().mockRejectedValue({ data: { total: 1, results: [] } })
    });
    const { operationButtonsProps } = build(api, { destroy: true });

    await getButton(operationButtonsProps).onClick({ row: { pk: "s-3" } });

    expect(api.destroy).toHaveBeenCalledWith("s-3");
    expect(showReferences).toHaveBeenCalledWith(
      expect.objectContaining({ total: 1 }),
      "s-3"
    );
  });

  it("用户取消确认时不发删除请求", async () => {
    confirmMock.mockResolvedValue(false);
    const api = makeApi();
    const { operationButtonsProps } = build(api, { destroy: true });

    await getButton(operationButtonsProps).onClick({ row: { pk: "s-4" } });

    expect(api.destroy).not.toHaveBeenCalled();
  });
});
