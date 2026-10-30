import { flushPromises, mount } from "@vue/test-utils";
import { ElAlert, ElButton, ElMessageBox } from "element-plus";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("vue-i18n", async importOriginal => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) };
});

const bindingsFn = vi.fn();
const providersFn = vi.fn();
const { unbindFn, encryptedFn } = vi.hoisted(() => ({
  unbindFn: vi.fn(),
  encryptedFn: vi.fn(async (_key: string, value: string) => `enc:${value}`)
}));

vi.mock("@/api/identity/oauth", () => ({
  oauthApi: {
    bindings: () => bindingsFn(),
    providers: () => providersFn(),
    unbind: (pk: string, password: string) => unbindFn(pk, password),
    bindAuthorize: vi.fn()
  }
}));

vi.mock("@/utils/message", () => ({ message: vi.fn() }));
vi.mock("@/utils/aes", () => ({ AesEncrypted: encryptedFn }));
vi.mock("@/store/modules/user", () => ({
  useUserStoreHook: () => ({ username: "alice" })
}));

import OAuthBindings from "./OAuthBindings.vue";

const mountPanel = async () => {
  const wrapper = mount(OAuthBindings, {
    global: {
      // el-alert / el-button 用真实组件（文案在 title / 插槽里，stub 后断言不可见）
      components: { ElAlert, ElButton },
      directives: { loading: {} },
      stubs: {
        ReEmpty: {
          props: ["description"],
          template: '<div class="empty">{{ description }}</div>'
        }
      }
    }
  });
  await flushPromises();
  return wrapper;
};

describe("第三方账号绑定页签", () => {
  beforeEach(() => {
    bindingsFn.mockResolvedValue({ code: 1000, data: [] });
    providersFn.mockResolvedValue({ code: 1000, data: { providers: [] } });
    unbindFn.mockResolvedValue({ code: 1000, data: null });
    encryptedFn.mockClear();
  });

  it("渲染标题与绑定说明区块", async () => {
    const wrapper = await mountPanel();

    expect(wrapper.find("h3").text()).toBe("oauth.tabTitle");
    expect(wrapper.text()).toContain("oauth.bound");
    expect(wrapper.text()).toContain("oauth.bindable");
  });

  it("未配置 provider 时给出提示（不静默空白）", async () => {
    const wrapper = await mountPanel();

    expect(wrapper.text()).toContain("oauth.providerNotConfigured");
  });

  it("清单加载失败时展示错误与重试，而不是「未绑定」", async () => {
    bindingsFn.mockRejectedValue(new Error("network down"));
    const wrapper = await mountPanel();

    expect(wrapper.text()).toContain("network down");
    expect(wrapper.text()).toContain("buttons.retry");
    expect(wrapper.text()).not.toContain("oauth.noBindings");
  });

  it("已有绑定时列出 provider 与解绑入口", async () => {
    bindingsFn.mockResolvedValue({
      code: 1000,
      data: [
        {
          pk: "1",
          provider: "wechat",
          provider_name: "微信",
          subject: "s1",
          profile: { nickname: "小张" },
          created_time: "2026-10-09"
        }
      ]
    });

    const wrapper = await mountPanel();

    expect(wrapper.text()).toContain("微信 · 小张");
    expect(wrapper.text()).toContain("oauth.unbind");
  });

  it("解绑前按账号加密口令，不提交明文", async () => {
    bindingsFn.mockResolvedValue({
      code: 1000,
      data: [
        {
          pk: "7",
          provider: "wechat",
          provider_name: "微信",
          subject: "s7",
          profile: { nickname: "小张" }
        }
      ]
    });
    const promptSpy = vi
      .spyOn(ElMessageBox, "prompt")
      .mockResolvedValue({ value: "Secret@123" } as never);

    const wrapper = await mountPanel();
    await wrapper.find(".binding-row button").trigger("click");
    await flushPromises();

    expect(encryptedFn).toHaveBeenCalledWith("alice", "Secret@123");
    expect(unbindFn).toHaveBeenCalledWith("7", "enc:Secret@123");
    promptSpy.mockRestore();
  });
});
