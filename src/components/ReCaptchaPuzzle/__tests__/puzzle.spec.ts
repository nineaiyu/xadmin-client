import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createI18n } from "vue-i18n";

vi.mock("@/components/ReSliderCaptcha", () => ({
  default: {
    name: "ReSliderCaptcha",
    emits: ["start", "move", "end"],
    template: "<div class='slider-stub' />"
  }
}));

import { ReCaptchaPuzzle } from "../index";

const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  messages: {
    "zh-CN": {
      sliderTranslateCaptcha: { text: "拖动滑块拼合图片缺口" }
    }
  }
});

const CHALLENGE = {
  challenge_id: "c1",
  type: "slide" as const,
  background: "data:image/png;base64,x",
  piece: "data:image/png;base64,y",
  width: 320,
  height: 180,
  piece_size: 56,
  ttl: 120
};

describe("ReCaptchaPuzzle", () => {
  it("滑条 start/move/end 聚合为带轨迹的提交载荷", async () => {
    const wrapper = mount(ReCaptchaPuzzle, {
      props: { challenge: CHALLENGE },
      global: {
        plugins: [i18n],
        stubs: {
          ReSliderCaptcha: {
            name: "ReSliderCaptcha",
            emits: ["start", "move", "end"],
            template: "<div class='slider-stub' />"
          }
        }
      }
    });
    const slider = wrapper.findComponent({ name: "ReSliderCaptcha" });
    slider.vm.$emit("start");
    slider.vm.$emit("move", { event: new Event("pointermove"), moveX: 80 });
    slider.vm.$emit("end");

    const payload = wrapper.emitted("submit")?.at(-1)?.[0] as {
      answer: { x: number };
      track: { t: number }[];
    };
    expect(payload.answer).toHaveProperty("x");
    expect(payload.track.length).toBeGreaterThanOrEqual(2);
    expect(payload.track.at(-1)?.t).toBeGreaterThanOrEqual(0);
  });

  it("渲染底图与拼块图层", () => {
    const wrapper = mount(ReCaptchaPuzzle, {
      props: { challenge: CHALLENGE },
      global: {
        plugins: [i18n],
        stubs: {
          ReSliderCaptcha: { name: "ReSliderCaptcha", template: "<div />" }
        }
      }
    });
    expect(wrapper.find(".re-captcha-puzzle__bg").attributes("src")).toBe(
      CHALLENGE.background
    );
    expect(wrapper.find(".re-captcha-puzzle__piece").attributes("src")).toBe(
      CHALLENGE.piece
    );
  });
});
