import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ReSkeleton from "../src/index.vue";

const mountSkeleton = (props: Record<string, unknown> = {}) =>
  mount(ReSkeleton, { props });

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

  it("装饰性输出：容器对读屏隐藏（aria-hidden）", () => {
    expect(mountSkeleton().attributes("aria-hidden")).toBe("true");
  });
});
