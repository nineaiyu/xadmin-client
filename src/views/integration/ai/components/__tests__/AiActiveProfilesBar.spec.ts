import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ElAlert, ElButton, ElTag } from "element-plus";

const mocks = vi.hoisted(() => ({
  retrieve: vi.fn(),
  list: vi.fn()
}));

vi.mock("vue-i18n", async importOriginal => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key })
  };
});
vi.mock("@/api/ai/ai", async importOriginal => {
  const actual = await importOriginal<typeof import("@/api/ai/ai")>();
  return {
    ...actual,
    aiConfigApi: { retrieve: mocks.retrieve },
    aiProfileApi: { list: mocks.list }
  };
});

import AiActiveProfilesBar from "../AiActiveProfilesBar.vue";

const mountBar = () =>
  mount(AiActiveProfilesBar, {
    global: {
      components: { ElAlert, ElButton, ElTag },
      directives: { loading: () => undefined }
    }
  });

beforeEach(() => {
  mocks.retrieve.mockReset();
  mocks.list.mockReset();
  mocks.list.mockResolvedValue({ code: 1000, data: { results: [] } });
});

describe("AI 全局状态条", () => {
  it("配置读取 403/失败：显示未知，不伪造「已启用」", async () => {
    mocks.retrieve.mockRejectedValue({ detail: "Permission denied" });
    const wrapper = mountBar();
    await flushPromises();

    expect(wrapper.text()).toContain("aiConfig.statusUnknown");
    expect(wrapper.text()).not.toContain("aiConfig.assistantEnabled");
  });

  it("配置读取成功：渲染真实开关状态", async () => {
    mocks.retrieve.mockResolvedValue({
      code: 1000,
      data: { AI_ASSISTANT_ENABLED: true }
    });
    const wrapper = mountBar();
    await flushPromises();

    expect(wrapper.text()).toContain("aiConfig.assistantEnabled");
    expect(wrapper.text()).toContain("aiConfig.profileOn");
  });
});
