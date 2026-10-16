import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { nextTick } from "vue";
import { describe, expect, it } from "vitest";

import ReSliderCaptcha from "../src/index.vue";
import { actionOffset } from "../src/geometry";

const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  messages: {
    "zh-CN": {
      sliderCaptcha: { text: "向右拖动滑块填充拼图", successText: "验证通过" }
    }
  }
});

const pointer = (type: string, init: MouseEventInit = {}) =>
  new MouseEvent(type, { bubbles: true, button: 0, ...init });

const mountCaptcha = (props: Record<string, unknown> = {}) => {
  const wrapper = mount(ReSliderCaptcha, {
    props,
    global: { plugins: [i18n] }
  });
  const el = wrapper.find(".re-slider-captcha").element as HTMLElement;
  // jsdom 无布局：显式给出容器宽度，使 offset = 200 - 40 - 6 = 154
  Object.defineProperty(el, "offsetWidth", { value: 200, configurable: true });
  return wrapper;
};

const drag = async (wrapper: ReturnType<typeof mountCaptcha>, toX: number) => {
  wrapper
    .find(".re-slider-captcha__action")
    .element.dispatchEvent(pointer("pointerdown", { clientX: 0 }));
  await nextTick();
  window.dispatchEvent(pointer("pointermove", { clientX: toX }));
  await nextTick();
};

describe("ReSliderCaptcha 滑块验证码", () => {
  it("渲染默认提示文案", () => {
    expect(mountCaptcha().find(".re-slider-captcha__text").text()).toBe(
      "向右拖动滑块填充拼图"
    );
  });

  it("actionOffset 保证非负", () => {
    expect(actionOffset(200, 40, 6)).toBe(154);
    expect(actionOffset(30, 40, 6)).toBe(0);
  });

  it("拖到末端判定通过：发 success 且回写 v-model，文案切为通过态", async () => {
    const wrapper = mountCaptcha();
    await drag(wrapper, 160);
    expect(wrapper.emitted("start")).toBeTruthy();
    expect(wrapper.emitted("move")).toBeTruthy();
    expect(wrapper.emitted("success")?.at(-1)?.[0]).toMatchObject({
      isPassing: true
    });
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([true]);
    expect(wrapper.find(".re-slider-captcha__text").text()).toBe("验证通过");
  });

  it("未拖到末端：不发 success，抬起后发 end 并复位", async () => {
    const wrapper = mountCaptcha();
    await drag(wrapper, 50);
    window.dispatchEvent(pointer("pointerup"));
    await nextTick();
    expect(wrapper.emitted("success")).toBeUndefined();
    expect(wrapper.emitted("end")).toBeTruthy();
    expect(
      wrapper.find(".re-slider-captcha__action").attributes("style")
    ).toContain("left: 0px");
  });

  it("isSlot=true 时拖到末端不自动通过（交外部判定）", async () => {
    const wrapper = mountCaptcha({ isSlot: true });
    await drag(wrapper, 160);
    expect(wrapper.emitted("success")).toBeUndefined();
    expect(wrapper.emitted("move")?.at(-1)?.[0]).toMatchObject({ moveX: 154 });
  });

  it("外部把 v-model 置回 false 时复位", async () => {
    const wrapper = mountCaptcha({ modelValue: true });
    await nextTick();
    expect(wrapper.find(".re-slider-captcha__text").text()).toBe("验证通过");
    await wrapper.setProps({ modelValue: false });
    await nextTick();
    expect(wrapper.find(".re-slider-captcha__text").text()).toBe(
      "向右拖动滑块填充拼图"
    );
  });
});
