import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setWatermark: vi.fn(),
  clear: vi.fn()
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("vue-router", () => ({
  useRoute: () => ({ path: "/settings/basic" })
}));
vi.mock("@vueuse/core", () => ({
  useDebounceFn: (fn: (...args: unknown[]) => void) => fn
}));
vi.mock("@pureadmin/utils", () => ({
  useWatermark: () => ({
    setWatermark: mocks.setWatermark,
    clear: mocks.clear
  })
}));
vi.mock("@/store/modules/user", () => ({
  useUserStoreHook: () => ({
    username: "admin",
    nickname: "管理员",
    phone: "13800000000",
    email: "a@b.com",
    pk: 1
  })
}));
vi.mock("@/views/settings/components/settings-shell/SettingItem.vue", () => ({
  default: {
    name: "SettingItem",
    emits: ["change"],
    template: "<div data-testid='setting-item' />"
  }
}));

import SettingItem from "@/views/settings/components/settings-shell/SettingItem.vue";
import WatermarkSetting from "../WatermarkSetting.vue";

const item = {
  api: {} as never,
  auth: { retrieve: true, partialUpdate: true }
};

const emitValues = async (
  wrapper: ReturnType<typeof mount>,
  values: Record<string, unknown>
) => {
  wrapper.findComponent(SettingItem).vm.$emit("change", values);
  await wrapper.vm.$nextTick();
};

describe("WatermarkSetting 预览总开关与路径范围", () => {
  it("总开关关闭：清空预览并提示已关闭", async () => {
    const wrapper = mount(WatermarkSetting, {
      props: { item },
      attachTo: document.body
    });
    await emitValues(wrapper, {
      FRONT_END_WEB_WATERMARK_ENABLED: false,
      FRONT_END_WEB_WATERMARK_TEXT: "{{username}}"
    });

    expect(mocks.clear).toHaveBeenCalled();
    expect(mocks.setWatermark).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="watermark-preview-note"]').text()).toBe(
      "settingWatermark.previewDisabled"
    );
    wrapper.unmount();
  });

  it("当前页不在生效路径：保留样式预览并提示不生效", async () => {
    mocks.setWatermark.mockClear();
    const wrapper = mount(WatermarkSetting, {
      props: { item },
      attachTo: document.body
    });
    await emitValues(wrapper, {
      FRONT_END_WEB_WATERMARK_ENABLED: true,
      FRONT_END_WEB_WATERMARK_TEXT: "{{username}}",
      FRONT_END_WEB_WATERMARK_PATHS: "/system/user/index"
    });

    expect(mocks.setWatermark).toHaveBeenCalled();
    expect(wrapper.find('[data-testid="watermark-preview-note"]').text()).toBe(
      "settingWatermark.previewOutOfScope"
    );
    wrapper.unmount();
  });
});
