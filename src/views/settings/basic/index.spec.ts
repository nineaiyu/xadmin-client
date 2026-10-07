import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasAuth: vi.fn((_code: string) => true)
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/router/utils", () => ({ hasAuth: mocks.hasAuth }));
vi.mock("@/api/system/settings", () => ({
  settingsBasicApi: {},
  settingsMonitorApi: {}
}));
vi.mock("@/store/modules/watermark", () => ({
  useWatermarkStoreHook: () => ({ refreshSiteWatermark: vi.fn() })
}));
vi.mock("@/views/settings/components/settings/index.vue", () => ({
  default: {
    name: "Setting",
    props: ["modelValue"],
    template: "<div><slot /></div>"
  }
}));
vi.mock("@/views/settings/components/settings/SettingItem.vue", () => ({
  default: {
    name: "SettingItem",
    template: "<div data-testid='monitor-item' />"
  }
}));
vi.mock("./components/WatermarkSetting.vue", () => ({
  default: {
    name: "WatermarkSetting",
    props: ["item"],
    template: "<div data-testid='watermark-setting' />"
  }
}));

import Setting from "@/views/settings/components/settings/index.vue";
import WatermarkSetting from "./components/WatermarkSetting.vue";
import index from "./index.vue";

const mountPage = () =>
  mount(index, {
    global: {
      // el-tab-pane 桩：始终渲染插槽，页签内容断言落在挂载组件的 auth 装配上
      stubs: {
        "el-tab-pane": { template: "<div><slot /></div>" }
      }
    }
  });

/** Setting 页签装配的 auth 形态（settingItemProps.auth 子集） */
type TabAuth = { auth?: { partialUpdate?: boolean; retrieve: boolean } };

const getBasicAuth = (wrapper: ReturnType<typeof mountPage>) =>
  (wrapper.findComponent(Setting).props("modelValue") as TabAuth[])[0]!.auth!;

const getWatermarkAuth = (wrapper: ReturnType<typeof mountPage>) =>
  (wrapper.findComponent(WatermarkSetting).props("item") as TabAuth).auth!;

describe("SettingBasic 页签权限位拆分", () => {
  it("基本页签按 SettingBasic 判权，水印页签按 SettingWatermark 独立判权", () => {
    mocks.hasAuth.mockReturnValue(true);
    const wrapper = mountPage();

    const basicAuth = getBasicAuth(wrapper);
    const watermarkAuth = getWatermarkAuth(wrapper);

    expect(basicAuth.partialUpdate).toBe(true);
    expect(basicAuth.retrieve).toBe(true);
    expect(mocks.hasAuth).toHaveBeenCalledWith("partialUpdate:SettingBasic");
    expect(mocks.hasAuth).toHaveBeenCalledWith("retrieve:SettingBasic");

    expect(watermarkAuth.partialUpdate).toBe(true);
    expect(watermarkAuth.retrieve).toBe(true);
    expect(mocks.hasAuth).toHaveBeenCalledWith(
      "partialUpdate:SettingWatermark"
    );
    expect(mocks.hasAuth).toHaveBeenCalledWith("retrieve:SettingWatermark");
  });

  it("仅回收水印权限位时不影响基本页签（授权粒度拆分的核心语义）", () => {
    mocks.hasAuth.mockImplementation(
      (code: string) => !code.endsWith(":SettingWatermark")
    );
    const wrapper = mountPage();

    const basicAuth = getBasicAuth(wrapper);
    const watermarkAuth = getWatermarkAuth(wrapper);

    expect(basicAuth.partialUpdate).toBe(true);
    expect(basicAuth.retrieve).toBe(true);
    expect(watermarkAuth.partialUpdate).toBe(false);
    expect(watermarkAuth.retrieve).toBe(false);
  });
});
