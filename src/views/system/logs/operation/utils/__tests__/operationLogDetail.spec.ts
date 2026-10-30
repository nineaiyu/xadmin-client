import { describe, expect, it, vi } from "vitest";

import { useOperationLog } from "../hook";

/**
 * 操作日志详情正文口径：
 * 列表的 changes 已降为有界预览，详情必须按主键 retrieve 取全量变更对照；
 * 拉取失败回退列表行（返回 null），不阻断抽屉打开。
 */

const state = vi.hoisted(() => ({
  retrieveMock: vi.fn(),
  slowThresholdMock: vi.fn(),
  messageMock: vi.fn()
}));

vi.mock("@/api/audit/logs/operation", () => ({
  operationLogApi: {
    retrieve: state.retrieveMock,
    slowThreshold: state.slowThresholdMock
  }
}));
// 仅列格式化为本测试无关项，替换整包引入（避免拉起 plugins/i18n 初始化）
vi.mock("@/components/RePlusPage", async () => {
  const { defineListPage } =
    await import("@/components/RePlusPage/src/utils/defineListPage");
  return {
    defineListPage,
    formatPageColumns: (columns: unknown) => columns
  };
});
vi.mock("@/router/utils", () => ({
  usePageAuth: () => ({ list: true, retrieve: true })
}));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key })
}));
vi.mock("@/views/system/hooks", () => ({ goUserDetail: vi.fn() }));
vi.mock("@/utils/message", () => ({ message: state.messageMock }));

describe("useOperationLog detailRowFetch 详情正文口径", () => {
  it("按主键 retrieve 取全量变更（列表 changes 只是预览）", async () => {
    const { detailRowFetch } = useOperationLog();
    const detail = { pk: "9", changes: '[{"field":"name"}]' };
    state.retrieveMock.mockResolvedValue({ code: 1000, data: detail });
    const extra = await detailRowFetch({ pk: "9", changes_truncated: true });
    expect(extra).toEqual(detail);
    expect(state.retrieveMock).toHaveBeenCalledWith("9");
  });

  it("拉取失败回退列表行（返回 null 不阻断抽屉）", async () => {
    const { detailRowFetch } = useOperationLog();
    state.retrieveMock.mockRejectedValue(new Error("network"));
    const extra = await detailRowFetch({ pk: "9" });
    expect(extra).toBeNull();
    expect(state.retrieveMock).toHaveBeenCalledWith("9");
  });
});
