import { describe, expect, it, vi } from "vitest";

import { SUCCESS_CODE } from "@/api/types";
import { useOperationLog } from "../hook";

/**
 * 操作日志详情抽屉全量兜底单测。
 *
 * 核心回归：列表行 body / response_result 为有界预览（附 `*_truncated` 标记），
 * 详情抽屉打开前须按标记经 retrieve 拉全量回填；未截断不额外请求，
 * 拉取失败回退列表行预览且不阻断抽屉打开。
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
vi.mock("@/components/RePlusPage", () => ({
  formatPageColumns: (columns: unknown) => columns
}));
vi.mock("@/router/utils", () => ({
  usePageAuth: () => ({ list: true, retrieve: true })
}));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key })
}));
vi.mock("@/views/system/hooks", () => ({ goUserDetail: vi.fn() }));
vi.mock("@/utils/message", () => ({ message: state.messageMock }));

describe("useOperationLog detailRowFetch 详情全量兜底", () => {
  it("命中 body 截断标记时拉取详情端点回填全量", async () => {
    const fullRow = { pk: "9", body: { full: true }, body_truncated: false };
    state.retrieveMock.mockResolvedValue({
      code: SUCCESS_CODE,
      detail: "ok",
      data: fullRow
    });
    const { detailRowFetch } = useOperationLog();
    const extra = await detailRowFetch({ pk: "9", body_truncated: true });
    expect(state.retrieveMock).toHaveBeenCalledWith("9");
    expect(extra).toEqual(fullRow);
  });

  it("命中 response_result 截断标记时同样拉取全量", async () => {
    state.retrieveMock.mockResolvedValue({
      code: SUCCESS_CODE,
      detail: "ok",
      data: { pk: "9", response_result: { ok: 1 } }
    });
    const { detailRowFetch } = useOperationLog();
    const extra = await detailRowFetch({
      pk: "9",
      response_result_truncated: true
    });
    expect(state.retrieveMock).toHaveBeenCalledTimes(1);
    expect(extra).toEqual({ pk: "9", response_result: { ok: 1 } });
  });

  it("未截断时不发起额外请求（列表预览够用）", async () => {
    const { detailRowFetch } = useOperationLog();
    const extra = await detailRowFetch({ pk: "9" });
    expect(state.retrieveMock).not.toHaveBeenCalled();
    expect(extra).toBeNull();
  });

  it("业务失败经消息出口提示并回退行数据（返回 null 不阻断抽屉）", async () => {
    state.retrieveMock.mockResolvedValue({
      code: 1001,
      detail: "permission denied"
    });
    const { detailRowFetch } = useOperationLog();
    const extra = await detailRowFetch({ pk: "9", body_truncated: true });
    expect(state.messageMock).toHaveBeenCalledWith(
      "results.failed，permission denied",
      { type: "error" }
    );
    expect(extra).toBeNull();
  });

  it("请求异常静默回退行数据（异常提示由 http 拦截器统一出口）", async () => {
    state.retrieveMock.mockRejectedValue(new Error("network down"));
    const { detailRowFetch } = useOperationLog();
    const extra = await detailRowFetch({
      pk: "9",
      response_result_truncated: true
    });
    expect(extra).toBeNull();
    expect(state.messageMock).not.toHaveBeenCalled();
  });
});
