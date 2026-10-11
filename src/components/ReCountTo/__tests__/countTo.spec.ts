import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import ReNormalCountTo from "../src/normal";

/** 可控 rAF：手动按帧推进，避免测试依赖真实时间 */
function stubFrames() {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  return frames;
}

describe("ReNormalCountTo 数字滚动", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("按 decimals / separator / decimal 格式化数值", () => {
    const wrapper = mount(ReNormalCountTo, {
      props: {
        autoplay: false,
        startVal: 1234567.89,
        endVal: 1234567.89,
        decimals: 2
      }
    });
    expect(wrapper.text()).toContain("1,234,567.89");
  });

  it("未传插槽时输出与旧版一致（单个 span 文本）；prefix / suffix 插槽分列数字两侧", () => {
    const plain = mount(ReNormalCountTo, {
      props: { autoplay: false, startVal: 5, endVal: 5 }
    });
    expect(plain.element.tagName).toBe("SPAN");
    expect(plain.text()).toBe("5");

    const wrapper = mount(ReNormalCountTo, {
      props: { autoplay: false, startVal: 5, endVal: 5 },
      slots: {
        prefix: '<i class="ct-prefix" />',
        suffix: '<i class="ct-suffix" />'
      }
    });
    expect(wrapper.find(".ct-prefix").exists()).toBe(true);
    expect(wrapper.find(".ct-suffix").exists()).toBe(true);
  });

  it("挂载即发 mounted；autoplay 时并发 started", () => {
    stubFrames();
    const wrapper = mount(ReNormalCountTo, {
      props: { startVal: 0, endVal: 10 }
    });
    expect(wrapper.emitted("mounted")).toBeTruthy();
    expect(wrapper.emitted("started")).toBeTruthy();
  });

  it("动画跑完发出 finished（与 callback 同帧落定到 endVal）", async () => {
    const frames = stubFrames();
    const wrapper = mount(ReNormalCountTo, {
      props: { startVal: 0, endVal: 100, duration: 100 }
    });
    frames.shift()?.(1000);
    frames.shift()?.(1100);
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("callback")).toBeTruthy();
    expect(wrapper.emitted("finished")).toBeTruthy();
    expect(wrapper.text()).toContain("100");
  });

  it("transition 预设参与缓动：非线性预设取值区别于线性插值", async () => {
    const frames = stubFrames();
    const wrapper = mount(ReNormalCountTo, {
      props: {
        startVal: 0,
        endVal: 100,
        duration: 100,
        // easeIn 形态：进度 0.5 → 0.25（线性则为 0.5，可据此区分）
        transition: (t: number) => t * t
      }
    });
    frames.shift()?.(1000);
    frames.shift()?.(1050);
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("25");
  });
});
