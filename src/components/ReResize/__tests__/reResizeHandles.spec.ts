import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import ReResize from "../src/index.vue";

/**
 * 手柄「屏幕尺寸恒定」：外层整体 `transform: scale(z)` 时（自由画布缩放编辑），
 * 手柄按 1/z 反缩放（CSS 变量 `--re-resize-inv`），避免缩小后命中区只剩几像素。
 */
describe("ReResize 手柄反缩放变量", () => {
  it("scale = 1（缺省）时反缩放系数为 1，旧用法零变化", () => {
    const wrapper = mount(ReResize);
    const style = wrapper.find(".re-resize").attributes("style") ?? "";
    expect(style).toContain("--re-resize-inv: 1");
  });

  it("scale = 0.5 时反缩放系数为 2（手柄屏幕尺寸不变）", () => {
    const wrapper = mount(ReResize, { props: { scale: 0.5 } });
    const style = wrapper.find(".re-resize").attributes("style") ?? "";
    expect(style).toContain("--re-resize-inv: 2");
  });

  it("非法 scale（0 / 负数）按 1 处理，不产生 Infinity", () => {
    for (const scale of [0, -2]) {
      const wrapper = mount(ReResize, { props: { scale } });
      const style = wrapper.find(".re-resize").attributes("style") ?? "";
      expect(style).toContain("--re-resize-inv: 1");
    }
  });
});
