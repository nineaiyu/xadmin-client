import { flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";
import { ElAlert, ElButton } from "element-plus";

const mocks = vi.hoisted(() => ({
  hasAuth: vi.fn((_code: string) => true),
  backends: vi.fn()
}));

vi.mock("@/router/utils", () => ({ hasAuth: mocks.hasAuth }));
// 失败态提示与重试按钮需要 i18n 的 t（key 直出即可）
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/api/system/settings", () => ({
  settingsSmsServerApi: { backends: mocks.backends },
  settingsSmsConfigApi: { marker: "sms-config-api" }
}));
vi.mock("@/views/settings/components/settings/index.vue", () => ({
  default: {
    name: "Setting",
    props: ["modelValue"],
    template: "<div data-testid='setting-host' />"
  }
}));

import sms from "./sms.vue";

const SUCCESS_CODE = 1000;

/** v-loading 桩：记录指令绑定值，断言页签容器 loading 置位/复位时序 */
const loadingValues = vi.fn();

const mountPage = () =>
  mount(sms, {
    global: {
      components: { ElAlert, ElButton },
      directives: {
        loading: {
          mounted: (_el: unknown, binding: { value: unknown }) =>
            loadingValues(binding.value),
          updated: (_el: unknown, binding: { value: unknown }) =>
            loadingValues(binding.value)
        }
      }
    }
  });

const settingHostItems = (wrapper: Awaited<ReturnType<typeof mountPage>>) =>
  wrapper.findComponent({ name: "Setting" }).props("modelValue") as Array<{
    label?: string;
    queryParams?: { category?: string };
  }>;

describe("SettingSms 渠道页签装配", () => {
  it("拉取 backends 期间页签容器处于 loading，结束后复位", async () => {
    let resolveBackends!: (value: unknown) => void;
    mocks.backends.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveBackends = resolve;
        })
    );
    mountPage();
    // 请求在途：容器 loading 置位
    await nextTick();
    expect(loadingValues).toHaveBeenLastCalledWith(true);

    resolveBackends({
      code: SUCCESS_CODE,
      data: [{ label: "Aliyun", value: "alibaba" }]
    });
    await flushPromises();
    expect(loadingValues).toHaveBeenLastCalledWith(false);
  });

  it("backends 数据并入动态子页签，静态渠道页签始终在前", async () => {
    mocks.backends.mockResolvedValue({
      code: SUCCESS_CODE,
      data: [
        { label: "Aliyun", value: "alibaba" },
        { label: "Tencent", value: "tencent" }
      ]
    });
    const wrapper = mountPage();
    await flushPromises();

    const items = settingHostItems(wrapper);
    expect(items).toHaveLength(3);
    expect(items[0].label).toBeUndefined(); // 静态渠道项：标签走 i18n
    expect(items[1]).toMatchObject({
      label: "Aliyun",
      queryParams: { category: "alibaba" }
    });
    expect(items[2]).toMatchObject({
      label: "Tencent",
      queryParams: { category: "tencent" }
    });
  });

  it("backends 数据非数组时按空处理，不抛错也不并入子项", async () => {
    mocks.backends.mockResolvedValue({
      code: SUCCESS_CODE,
      data: undefined
    });
    const wrapper = mountPage();
    await flushPromises();

    expect(settingHostItems(wrapper)).toHaveLength(1);
    expect(loadingValues).toHaveBeenLastCalledWith(false);
  });

  it("无 backends 权限时不发起拉取", async () => {
    mocks.hasAuth.mockImplementation(code => code !== "backends:SmsSetting");
    mountPage();
    await flushPromises();

    expect(mocks.backends).not.toHaveBeenCalled();
  });

  it("backends 失败：给出可读提示与重试入口，点击重试再次拉取", async () => {
    mocks.hasAuth.mockImplementation(() => true);
    mocks.backends.mockResolvedValue({ code: 1001, detail: "boom" });
    const wrapper = mountPage();
    await flushPromises();

    expect(loadingValues).toHaveBeenLastCalledWith(false);
    expect(wrapper.text()).toContain("settingSms.backendsLoadFailed");

    mocks.backends.mockResolvedValue({ code: SUCCESS_CODE, data: [] });
    await wrapper.find("button").trigger("click");
    await flushPromises();
    expect(mocks.backends).toHaveBeenCalledTimes(2);
  });
});
