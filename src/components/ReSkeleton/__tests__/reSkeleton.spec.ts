import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { describe, expect, it } from "vitest";

import ReSkeleton from "../src/index.vue";

const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  messages: { "zh-CN": { labels: { loading: "加载中…" } } }
});

const mountSkeleton = (props: Record<string, unknown> = {}) =>
  mount(ReSkeleton, { props, global: { plugins: [i18n] } });

describe("ReSkeleton 轻量骨架屏", () => {
  it("默认 text 变体渲染 3 行，末行宽度收窄", () => {
    const wrapper = mountSkeleton();
    const lines = wrapper.findAll(".re-skeleton__line");
    expect(lines).toHaveLength(3);
    expect(lines[0].attributes("style")).toContain("width: 100%");
    expect(lines[2].attributes("style")).toContain("width: 62%");
  });

  it("rows 超出 1–6 范围时钳制", () => {
    expect(
      mountSkeleton({ rows: 0 }).findAll(".re-skeleton__line")
    ).toHaveLength(1);
    expect(
      mountSkeleton({ rows: 99 }).findAll(".re-skeleton__line")
    ).toHaveLength(6);
  });

  it("fill 变体渲染单块（撑满容器）", () => {
    const wrapper = mountSkeleton({ variant: "fill" });
    expect(wrapper.find(".re-skeleton__fill").exists()).toBe(true);
    expect(wrapper.findAll(".re-skeleton__line")).toHaveLength(0);
  });

  it("animated=false 时不挂脉冲类", () => {
    const wrapper = mountSkeleton({ animated: false });
    expect(wrapper.classes()).not.toContain("re-skeleton--animated");
    const animated = mountSkeleton();
    expect(animated.classes()).toContain("re-skeleton--animated");
  });

  it("加载态语义：容器对读屏播报加载中，装饰块 aria-hidden", () => {
    const wrapper = mountSkeleton();
    expect(wrapper.attributes("role")).toBe("status");
    expect(wrapper.attributes("aria-busy")).toBe("true");
    expect(wrapper.find(".sr-only").exists()).toBe(true);
    expect(wrapper.find(".re-skeleton__line").attributes("aria-hidden")).toBe(
      "true"
    );
  });
});
