import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  getColumnData: vi.fn(),
  retrieve: vi.fn()
}));

vi.mock("@/components/RePlusPage", () => ({
  useBaseColumns: () => ({ getColumnData: state.getColumnData }),
  handleOperation: vi.fn()
}));
vi.mock("plus-pro-components", () => ({
  PlusForm: { name: "PlusForm", template: "<form><slot /></form>" }
}));
vi.mock("@vueuse/core", () => ({ useMediaQuery: () => false }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

import SettingItem from "../SettingItem.vue";

/**
 * 设置项面板：无 retrieve 权限时不得渲染空白表单（用户会误以为配置为空）；
 * 列元数据请求失败时 loading 必须收尾并给出可重试的失败态。
 */
const api = {
  columns: vi.fn(),
  create: vi.fn(),
  retrieve: state.retrieve,
  partialUpdate: vi.fn()
};

const mountItem = (retrieve: boolean) =>
  mount(SettingItem, {
    props: {
      api: api as never,
      auth: { retrieve, partialUpdate: false },
      localeName: "settingA"
    }
  });

beforeEach(() => {
  vi.clearAllMocks();
  state.retrieve.mockResolvedValue({ code: 1000, data: {} });
  state.getColumnData.mockResolvedValue(undefined);
});

describe("SettingItem 权限与失败态", () => {
  it("无 retrieve：只给无权限说明，不请求列元数据与配置", () => {
    const wrapper = mountItem(false);

    expect(
      wrapper.find('[data-testid="setting-item-no-permission"]').exists()
    ).toBe(true);
    expect(state.getColumnData).not.toHaveBeenCalled();
    expect(state.retrieve).not.toHaveBeenCalled();
  });

  it("列元数据请求失败：loading 收尾并展示可重试失败态", async () => {
    state.getColumnData.mockRejectedValueOnce(new Error("boom"));
    const wrapper = mountItem(true);
    await flushPromises();

    const failed = wrapper.find('[data-testid="setting-load-failed"]');
    expect(failed.exists()).toBe(true);

    state.getColumnData.mockResolvedValueOnce(undefined);
    await failed.find("el-button").trigger("click");
    await flushPromises();
    expect(state.getColumnData).toHaveBeenCalledTimes(2);
  });

  it("正常加载：渲染表单，无权限/失败占位都不出现", async () => {
    const wrapper = mountItem(true);
    await flushPromises();

    expect(wrapper.find("form").exists()).toBe(true);
    expect(
      wrapper.find('[data-testid="setting-item-no-permission"]').exists()
    ).toBe(false);
    expect(wrapper.find('[data-testid="setting-load-failed"]').exists()).toBe(
      false
    );
  });
});
