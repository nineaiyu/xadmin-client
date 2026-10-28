import { describe, expect, it, vi } from "vitest";

import { useOperationLog } from "../hook";

/**
 * 操作日志详情正文口径（LOG-P1-01）：
 * 后端 retrieve / 导出与列表同级，body / response_result 只有有界预览；
 * 详情抽屉直接复用列表行（changes 全量 + 正文预览标记），不再二次拉取。
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
  it("截断标记不再触发 retrieve（后端 retrieve 同为有界预览）", async () => {
    const { detailRowFetch } = useOperationLog();
    const extra = await detailRowFetch({
      pk: "9",
      body_truncated: true,
      response_result_truncated: true
    });
    expect(extra).toBeNull();
    expect(state.retrieveMock).not.toHaveBeenCalled();
  });

  it("普通行同样直接使用列表数据", async () => {
    const { detailRowFetch } = useOperationLog();
    const extra = await detailRowFetch({ pk: "9" });
    expect(extra).toBeNull();
    expect(state.retrieveMock).not.toHaveBeenCalled();
  });
});
