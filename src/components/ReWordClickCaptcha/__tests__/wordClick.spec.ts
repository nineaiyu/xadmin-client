import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { createI18n } from "vue-i18n";

import { ReWordClickCaptcha } from "../index";

const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  messages: {
    "zh-CN": {
      captchaChallenge: {
        clickHint: "请按提示顺序依次点击图中文字",
        tipAlt: "点选文字提示",
        clickStage: "点选验证码图片",
        clickStageKeyboard: "点选验证码图片（键盘可操作）",
        clickAlt: "文字点选验证码",
        selected: "已选 {count}/{total}",
        resetSelection: "重选",
        confirm: "确认"
      }
    }
  }
});

const CHALLENGE = {
  challenge_id: "c1",
  type: "click" as const,
  background: "data:image/png;base64,x",
  tip: "data:image/png;base64,y",
  width: 320,
  height: 180,
  count: 3,
  ttl: 120
};

const stubs = {
  ElButton: {
    name: "ElButton",
    emits: ["click"],
    template: "<button @click=\"$emit('click')\"><slot /></button>"
  }
};

describe("ReWordClickCaptcha", () => {
  it("三次点击按显示尺寸换算自然坐标，确认后提交有序点集", async () => {
    const wrapper = mount(ReWordClickCaptcha, {
      props: { challenge: CHALLENGE },
      global: { plugins: [i18n], stubs }
    });
    const stage = wrapper.find(".re-word-click__stage");
    Object.defineProperty(stage.element, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, width: 640, height: 360 })
    });

    const clicks = [
      [64, 36],
      [320, 180],
      [576, 324]
    ];
    for (const [clientX, clientY] of clicks) {
      await stage.trigger("click", { clientX, clientY });
    }
    expect(wrapper.findAll(".re-word-click__marker")).toHaveLength(3);
    expect(wrapper.text()).toContain("已选 3/3");

    const buttons = wrapper.findAll("button");
    await buttons[buttons.length - 1].trigger("click");
    expect(wrapper.emitted("submit")?.at(-1)?.[0]).toMatchObject({
      answer: {
        points: [
          { x: 32, y: 18 },
          { x: 160, y: 90 },
          { x: 288, y: 162 }
        ]
      }
    });
  });

  it("键盘：方向键移动准星 + Enter 落点，提交 input=keyboard", async () => {
    const wrapper = mount(ReWordClickCaptcha, {
      props: { challenge: CHALLENGE },
      global: { plugins: [i18n], stubs }
    });
    const stage = wrapper.find(".re-word-click__stage");
    await stage.trigger("focus");
    await stage.trigger("keydown", { key: "ArrowRight" });
    await stage.trigger("keydown", { key: "Enter" });
    await stage.trigger("keydown", { key: "ArrowDown" });
    await stage.trigger("keydown", { key: "Enter" });
    await stage.trigger("keydown", { key: "Enter" });
    expect(wrapper.text()).toContain("已选 3/3");

    const buttons = wrapper.findAll("button");
    await buttons[buttons.length - 1].trigger("click");
    const payload = wrapper.emitted("submit")?.[0]?.[0] as {
      input: string;
      answer: { points: unknown[] };
    };
    expect(payload.input).toBe("keyboard");
    expect(payload.answer.points).toHaveLength(3);
  });

  it("未选满时确认不可用", () => {
    const wrapper = mount(ReWordClickCaptcha, {
      props: { challenge: CHALLENGE },
      global: { plugins: [i18n], stubs }
    });
    const buttons = wrapper.findAll("button");
    expect(buttons[buttons.length - 1].attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("已选 0/3");
  });
});
