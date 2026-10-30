import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import { describe, expect, it } from "vitest";

import type { CaptchaChallengeData } from "@/api/auth";
import Panel from "../src/Panel.vue";

const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  messages: {
    "zh-CN": {
      captchaChallenge: {
        challengeTitle: "请完成安全验证",
        refresh: "换一题",
        imageFallback: "使用图片验证码",
        success: "验证通过",
        loading: "正在加载验证码…",
        unsupportedType: "不支持的验证码类型",
        loadFailed: "加载失败"
      }
    }
  }
});

const baseProps = {
  loading: false,
  submitting: false,
  error: "",
  success: false,
  imageFallback: false,
  shake: false
};

const stubs = {
  ElAlert: {
    props: ["title"],
    template: '<div class="alert">{{ title }}</div>'
  },
  ElButton: { template: "<button><slot /></button>" },
  ReImageCaptcha: { template: "<div data-type='image' />" },
  ReCaptchaPuzzle: { template: "<div data-type='slide' />" },
  ReRotateCaptcha: { template: "<div data-type='rotate' />" },
  ReWordClickCaptcha: { template: "<div data-type='click' />" }
};

const mountPanel = (challenge: CaptchaChallengeData | null, extra = {}) =>
  mount(Panel, {
    props: { ...baseProps, challenge, ...extra },
    global: { plugins: [i18n], stubs }
  });

const challenge = (type: string) =>
  ({
    challenge_id: "c1",
    type,
    ttl: 120
  }) as CaptchaChallengeData;

describe("ReCaptchaPanel", () => {
  it("按题型分发到对应子组件", () => {
    expect(
      mountPanel(challenge("slide")).find("[data-type='slide']").exists()
    ).toBe(true);
    expect(
      mountPanel(challenge("rotate")).find("[data-type='rotate']").exists()
    ).toBe(true);
    expect(
      mountPanel(challenge("icon")).find("[data-type='click']").exists()
    ).toBe(true);
    expect(
      mountPanel(challenge("image")).find("[data-type='image']").exists()
    ).toBe(true);
  });

  it("未知题型给出可读提示而不是永久空白", () => {
    const wrapper = mountPanel(challenge("brand-new-type"));
    expect(wrapper.text()).toContain("不支持的验证码类型");
  });

  it("出题失败只显示一处错误文案", () => {
    const wrapper = mountPanel(null, { error: "验证码加载失败，请重试" });
    expect(wrapper.text().split("验证码加载失败，请重试")).toHaveLength(2);
    expect(wrapper.text()).not.toContain("正在加载验证码");
  });
});
