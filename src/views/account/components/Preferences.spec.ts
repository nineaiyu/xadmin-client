import { flushPromises, mount } from "@vue/test-utils";
import { ElSwitch, ElText } from "element-plus";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getConfig: vi.fn(),
  setConfig: vi.fn(),
  handleOperation: vi.fn(),
  message: vi.fn()
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/api/config", () => ({
  configApi: { getConfig: mocks.getConfig, setConfig: mocks.setConfig }
}));
vi.mock("@/components/RePlusPage", () => ({
  handleOperation: mocks.handleOperation
}));
vi.mock("@/utils/message", () => ({ message: mocks.message }));

import Preferences from "./Preferences.vue";

const SUCCESS_CODE = 1000;

const mountPreferences = async () => {
  const wrapper = mount(Preferences, {
    global: {
      components: { ElSwitch, ElText },
      stubs: { "el-divider": true }
    }
  });
  await flushPromises();
  return wrapper;
};

const switches = (wrapper: Awaited<ReturnType<typeof mountPreferences>>) =>
  wrapper.findAllComponents(ElSwitch);

describe("Preferences 偏好开关初态加载", () => {
  it("读取成功后按服务端配置回填初态并解除 loading", async () => {
    mocks.getConfig
      .mockResolvedValueOnce({
        code: SUCCESS_CODE,
        config: { value: true }
      })
      .mockResolvedValueOnce({
        code: SUCCESS_CODE,
        config: { value: false }
      });
    const wrapper = await mountPreferences();

    expect(mocks.getConfig).toHaveBeenCalledTimes(2);
    const [first, second] = switches(wrapper);
    expect(first.props("modelValue")).toBe(true);
    expect(second.props("modelValue")).toBe(false);
    expect(first.props("loading")).toBe(false);
    expect(first.props("disabled")).toBe(false);
    expect(mocks.message).not.toHaveBeenCalled();
  });

  it("读取失败（业务码）时提示并禁用开关，防止把默认值反向写入", async () => {
    mocks.getConfig.mockResolvedValue({ code: 500 });
    const wrapper = await mountPreferences();

    expect(mocks.message).toHaveBeenCalledWith("account.preferenceLoadFailed", {
      type: "warning"
    });
    for (const item of switches(wrapper)) {
      expect(item.props("modelValue")).toBe(false);
      expect(item.props("disabled")).toBe(true);
    }
  });

  it("读取异常（网络失败）时同样提示并禁用开关", async () => {
    mocks.getConfig.mockRejectedValue(new Error("network down"));
    const wrapper = await mountPreferences();

    expect(mocks.message).toHaveBeenCalledWith("account.preferenceLoadFailed", {
      type: "warning"
    });
    for (const item of switches(wrapper)) {
      expect(item.props("loading")).toBe(false);
      expect(item.props("disabled")).toBe(true);
    }
  });
});
