import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

import ReStateContainer from "../src/index.vue";

const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  messages: { "zh-CN": { reState: { empty: "暂无数据", error: "加载失败" } } }
});

const ElEmptyStub = {
  name: "ElEmpty",
  props: {
    description: { type: String, default: "" },
    imageSize: { type: Number, default: 0 }
  },
  template: '<div class="stub-empty">{{ description }}</div>'
};

const ElAlertStub = {
  name: "ElAlert",
  props: {
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    type: { type: String, default: "" }
  },
  template:
    '<div class="stub-alert" :data-type="type">{{ title }}|{{ description }}</div>'
};

const mountState = (props: Record<string, unknown> = {}, slots = {}) =>
  mount(ReStateContainer, {
    props,
    slots,
    global: {
      plugins: [i18n],
      stubs: { "el-empty": ElEmptyStub, "el-alert": ElAlertStub }
    }
  });

describe("ReStateContainer 四态容器", () => {
  it("ready（默认）只渲染默认插槽，不渲染任何状态占位", () => {
    const wrapper = mountState({}, { default: "<div class='body'>内容</div>" });
    expect(wrapper.find(".body").text()).toBe("内容");
    expect(wrapper.find(".re-skeleton").exists()).toBe(false);
    expect(wrapper.find(".stub-empty").exists()).toBe(false);
    expect(wrapper.find(".stub-alert").exists()).toBe(false);
  });

  it("loading 默认骨架屏；skeletonFill 走填充块", () => {
    expect(
      mountState({ state: "loading", minLoadingTime: 0 })
        .find(".re-skeleton")
        .exists()
    ).toBe(true);
    expect(
      mountState({ state: "loading", minLoadingTime: 0, skeletonFill: true })
        .find(".re-skeleton__fill")
        .exists()
    ).toBe(true);
  });

  it("loading 转圈形态展示文案", () => {
    const wrapper = mountState({
      state: "loading",
      minLoadingTime: 0,
      loadingVariant: "spinner",
      loadingText: "正在提交"
    });
    expect(wrapper.find(".re-state-container__spin").exists()).toBe(true);
    expect(wrapper.text()).toContain("正在提交");
  });

  it("empty 用 ReEmpty 渲染，缺省文案取内置、可被 emptyHint 覆盖", () => {
    expect(mountState({ state: "empty" }).find(".stub-empty").text()).toBe(
      "暂无数据"
    );
    expect(
      mountState({ state: "empty", emptyHint: "还没有记录" })
        .find(".stub-empty")
        .text()
    ).toBe("还没有记录");
  });

  it("error 用 el-alert 渲染标题与描述", () => {
    const wrapper = mountState({ state: "error", errorDetail: "网络异常" });
    const alert = wrapper.find(".stub-alert");
    expect(alert.attributes("data-type")).toBe("error");
    expect(alert.text()).toBe("加载失败|网络异常");
  });

  it("各态插槽可整体替换默认渲染", () => {
    const wrapper = mountState(
      { state: "loading", minLoadingTime: 0 },
      { loading: "<div class='custom-loading'>自定义</div>" }
    );
    expect(wrapper.find(".custom-loading").exists()).toBe(true);
    expect(wrapper.find(".re-skeleton").exists()).toBe(false);
  });

  it("minHeight 落到根节点内联样式", () => {
    expect(
      mountState({ minHeight: 120 })
        .find(".re-state-container")
        .attributes("style")
    ).toContain("min-height: 120px");
  });
});

describe("ReStateContainer 加载态延迟展示（minLoadingTime）", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("默认窗口内不渲染 loading 占位，到期未就绪才展示", async () => {
    vi.useFakeTimers();
    const wrapper = mountState({ state: "loading" });
    expect(wrapper.find(".re-skeleton").exists()).toBe(false);

    vi.advanceTimersByTime(50);
    await nextTick();
    expect(wrapper.find(".re-skeleton").exists()).toBe(true);
  });

  it("窗口内就绪则始终不渲染 loading 占位（防闪现）", async () => {
    vi.useFakeTimers();
    const wrapper = mountState(
      { state: "loading" },
      { default: "<div class='body'>内容</div>" }
    );
    await wrapper.setProps({ state: "ready" });

    vi.advanceTimersByTime(500);
    await nextTick();
    expect(wrapper.find(".re-skeleton").exists()).toBe(false);
    expect(wrapper.find(".body").text()).toBe("内容");
  });

  it("占位已展示后切 ready 立即让位，不再延迟", async () => {
    vi.useFakeTimers();
    const wrapper = mountState(
      { state: "loading" },
      { default: "<div class='body'>内容</div>" }
    );
    vi.advanceTimersByTime(50);
    await nextTick();
    expect(wrapper.find(".re-skeleton").exists()).toBe(true);

    await wrapper.setProps({ state: "ready" });
    expect(wrapper.find(".re-skeleton").exists()).toBe(false);
    expect(wrapper.find(".body").text()).toBe("内容");
  });

  it("延迟未到期即卸载不残留计时器", async () => {
    vi.useFakeTimers();
    const wrapper = mountState({ state: "loading" });
    wrapper.unmount();

    expect(() => vi.advanceTimersByTime(200)).not.toThrow();
  });
});
