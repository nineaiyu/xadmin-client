import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { createI18n } from "vue-i18n";

import { ReRotateCaptcha } from "../index";

const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  messages: {
    "zh-CN": {
      sliderRotateCaptcha: { text: "拖动滑块旋转图片至正向" }
    }
  }
});

const CHALLENGE = {
  challenge_id: "c1",
  type: "rotate" as const,
  background: "data:image/png;base64,x",
  width: 240,
  height: 240,
  ttl: 120
};

const stubs = {
  ReSliderCaptcha: {
    name: "ReSliderCaptcha",
    emits: ["start", "move", "end"],
    template: "<div class='slider-stub' />"
  }
};

describe("ReRotateCaptcha", () => {
  it("滑条位移映射为角度答案并携带轨迹", () => {
    const wrapper = mount(ReRotateCaptcha, {
      props: { challenge: CHALLENGE },
      global: { plugins: [i18n], stubs }
    });
    const slider = wrapper.findComponent({ name: "ReSliderCaptcha" });
    slider.vm.$emit("start");
    slider.vm.$emit("move", { event: new Event("pointermove"), moveX: 100 });
    slider.vm.$emit("end");

    const payload = wrapper.emitted("submit")?.at(-1)?.[0] as {
      answer: { angle: number };
      track: unknown[];
    };
    expect(typeof payload.answer.angle).toBe("number");
    expect(payload.answer.angle).toBeGreaterThanOrEqual(-180);
    expect(payload.answer.angle).toBeLessThanOrEqual(180);
    expect(payload.track.length).toBeGreaterThanOrEqual(2);
  });

  it("图片应用旋转样式", () => {
    const wrapper = mount(ReRotateCaptcha, {
      props: { challenge: CHALLENGE },
      global: { plugins: [i18n], stubs }
    });
    expect(
      wrapper.find(".re-rotate-captcha__image").attributes("style")
    ).toContain("rotate(");
  });
});
