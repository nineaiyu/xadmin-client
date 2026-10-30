import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  previewTrial: vi.fn(),
  previewFieldTrial: vi.fn()
}));
const messageMock = vi.hoisted(() => vi.fn());

vi.mock("@/api/identity/user", () => ({
  userApi: {
    previewTrial: (...args: unknown[]) => api.previewTrial(...args),
    previewFieldTrial: (...args: unknown[]) => api.previewFieldTrial(...args)
  }
}));
vi.mock("@/utils/message", () => ({ message: messageMock }));

import { useTrialDataPanel } from "../useTrialDataPanel";
import { useTrialFieldPanel } from "../useTrialFieldPanel";

function context() {
  return {
    t: (key: string) => key,
    targetPk: ref("user-1"),
    formMode: ref(0),
    boundMenuPks: ref<string[]>([]),
    menuContext: ref("menu-1"),
    loading: ref(false)
  };
}

beforeEach(() => {
  api.previewTrial.mockReset();
  api.previewFieldTrial.mockReset();
  messageMock.mockReset();
});

describe("权限试算业务码处理", () => {
  it("数据试算业务码失败：清空结果并提示 detail", async () => {
    api.previewTrial.mockResolvedValue({
      code: 1001,
      detail: "非法规则",
      data: null
    });
    const state = useTrialDataPanel({
      props: { rules: [{ field: "x" }], ruleList: [] } as never,
      ctx: context() as never
    });
    state.model.value = "identity.userinfo";

    await state.runDataTrial();

    expect(state.result.value).toBeNull();
    expect(messageMock).toHaveBeenCalledWith("非法规则", { type: "error" });
  });

  it("字段试算业务码失败：清空结果并提示 detail", async () => {
    api.previewFieldTrial.mockResolvedValue({
      code: 1001,
      detail: "无权模型",
      data: null
    });
    const state = useTrialFieldPanel({
      props: { rules: [], fieldRuleList: [] } as never,
      ctx: context() as never
    });

    await state.runFieldTrial();

    expect(state.fieldResult.value).toBeNull();
    expect(messageMock).toHaveBeenCalledWith("无权模型", { type: "error" });
  });
});
