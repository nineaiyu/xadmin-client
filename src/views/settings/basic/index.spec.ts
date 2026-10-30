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
// 骨架桩：按 panes 渲染面板（与真实骨架同语义）
vi.mock("@/views/settings/components/settings-shell/index.vue", () => ({
  default: {
    name: "Setting",
    props: ["panes"],
    template: `<div>
      <template v-for="pane in panes" :key="pane.key">
        <slot :name="pane.key" />
      </template>
    </div>`
  }
}));
vi.mock("@/views/settings/components/settings-shell/SettingItem.vue", () => ({
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

import Setting from "@/views/settings/components/settings-shell/index.vue";
import WatermarkSetting from "./components/WatermarkSetting.vue";
import index from "./index.vue";

const mountPage = () => mount(index, { global: {} });

/** Setting 面板装配的 auth 形态（settingItemProps.auth 子集） */
type TabAuth = { auth?: { partialUpdate?: boolean; retrieve: boolean } };
type PaneLike = { key?: string; item?: TabAuth };

const getBasicAuth = (wrapper: ReturnType<typeof mountPage>) =>
  (wrapper.findComponent(Setting).props("panes") as PaneLike[])[0]!.item!.auth!;

const getWatermarkAuth = (wrapper: ReturnType<typeof mountPage>) =>
  (wrapper.findComponent(WatermarkSetting).props("item") as TabAuth).auth!;

describe("SettingBasic 面板权限位拆分", () => {
  it("基本面板按 SettingBasic 判权，水印面板按 SettingWatermark 独立判权", () => {
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

  it("仅回收水印权限位时不影响基本面板，且水印页签不渲染", () => {
    mocks.hasAuth.mockImplementation(
      (code: string) => !code.endsWith(":SettingWatermark")
    );
    const wrapper = mountPage();

    expect(getBasicAuth(wrapper).retrieve).toBe(true);
    expect(wrapper.findComponent(WatermarkSetting).exists()).toBe(false);
    expect(
      (wrapper.findComponent(Setting).props("panes") as PaneLike[]).map(
        pane => pane.key
      )
    ).toEqual(["basic", "monitor"]);
  });

  it("仅持水印只读权限时水印页签仍渲染", () => {
    mocks.hasAuth.mockImplementation(
      (code: string) =>
        code === "retrieve:SettingWatermark" || code.endsWith(":SettingBasic")
    );
    const wrapper = mountPage();

    expect(getWatermarkAuth(wrapper).retrieve).toBe(true);
    expect(wrapper.findComponent(WatermarkSetting).exists()).toBe(true);
  });
});
