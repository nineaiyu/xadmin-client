import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { ElAlert, ElButton, ElInput } from "element-plus";
import type { ComponentPublicInstance } from "vue";
import { describe, expect, it } from "vitest";

import ReImageCaptcha from "../src/index.vue";

const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  messages: {
    "zh-CN": {
      captchaChallenge: {
        imageHint: "请输入图中字符",
        imageAlt: "验证码",
        imagePlaceholder: "验证码",
        imageSubmit: "提交",
        imageAudio: "播放音频",
        imagePowHint: "需要计算",
        powRunning: "计算中",
        powFailed: "计算失败"
      }
    }
  }
});

const challenge = {
  challenge_id: "challenge-1",
  background: "data:image/png;base64,xx",
  length: 4,
  audio: "",
  pow: null
} as never;

const mountCaptcha = () =>
  mount(ReImageCaptcha, {
    props: { challenge, submitting: false },
    global: { plugins: [i18n], components: { ElInput, ElButton, ElAlert } }
  });

describe("ReImageCaptcha", () => {
  it("输入为空时不提交，输入后提交 code", async () => {
    const wrapper = mountCaptcha();
    await wrapper.find('[data-testid="captcha-image-submit"]').trigger("click");
    expect(wrapper.emitted("submit")).toBeUndefined();

    await wrapper.find('[data-testid="captcha-image-input"]').setValue("ABCD");
    await wrapper.find('[data-testid="captcha-image-submit"]').trigger("click");
    expect(wrapper.emitted("submit")?.[0]?.[0]).toEqual({
      answer: { code: "ABCD" },
      track: [],
      input: "keyboard"
    });
  });

  it("reset 清空输入", async () => {
    const wrapper = mountCaptcha();
    const input = wrapper.find('[data-testid="captcha-image-input"]');
    await input.setValue("ABCD");
    (wrapper.vm as ComponentPublicInstance & { reset: () => void }).reset();
    await wrapper.vm.$nextTick();
    expect((input.element as HTMLInputElement).value).toBe("");
  });
});
