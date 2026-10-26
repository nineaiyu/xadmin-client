import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createI18n } from "vue-i18n";
import type { ComponentPublicInstance } from "vue";

const mocks = vi.hoisted(() => ({
  challenge: vi.fn(),
  verify: vi.fn()
}));

vi.mock("@/api/auth", () => ({
  captchaChallengeApi: mocks.challenge,
  captchaVerifyApi: mocks.verify
}));

vi.mock("@/components/ReCaptchaPuzzle", () => ({
  ReCaptchaPuzzle: {
    name: "ReCaptchaPuzzle",
    props: ["challenge"],
    emits: ["submit"],
    template: "<div class='puzzle-stub' />"
  }
}));
vi.mock("@/components/ReRotateCaptcha", () => ({
  ReRotateCaptcha: {
    name: "ReRotateCaptcha",
    props: ["challenge"],
    emits: ["submit"],
    template: "<div class='rotate-stub' />"
  }
}));
vi.mock("@/components/ReWordClickCaptcha", () => ({
  ReWordClickCaptcha: {
    name: "ReWordClickCaptcha",
    props: ["challenge"],
    emits: ["submit"],
    template: "<div class='click-stub' />"
  }
}));

import { ReCaptchaChallenge } from "../index";

const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  messages: {
    "zh-CN": {
      captchaChallenge: {
        title: "安全验证",
        challengeTitle: "请完成安全验证",
        refresh: "换一题",
        retryHint: "验证未通过，还可尝试 {count} 次",
        success: "验证通过",
        verifyFailed: "验证失败，请重试",
        loadFailed: "验证码加载失败，请重试"
      }
    }
  }
});

const CHALLENGE = {
  challenge_id: "c1",
  type: "slide" as const,
  background: "data:image/png;base64,x",
  piece: "data:image/png;base64,x",
  width: 320,
  height: 180,
  piece_size: 56,
  ttl: 120
};

const TRACK = [
  { x: 0, y: 0, t: 0 },
  { x: 100, y: 0, t: 200 }
];

const stubs = {
  ElButton: {
    name: "ElButton",
    emits: ["click"],
    template: "<button @click=\"$emit('click')\"><slot /></button>"
  },
  ElAlert: {
    name: "ElAlert",
    props: ["title"],
    template: "<div class='alert-stub'>{{ title }}</div>"
  }
};

const mountChallenge = () =>
  mount(ReCaptchaChallenge, {
    props: { scene: "login", types: ["slide"], inline: true },
    global: { plugins: [i18n], stubs }
  });

type ChallengeVm = ComponentPublicInstance & {
  open: () => Promise<string>;
  reset: () => void;
};

const vmOf = (wrapper: ReturnType<typeof mountChallenge>) =>
  wrapper.vm as ChallengeVm;

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("ReCaptchaChallenge 编排", () => {
  it("open() 拉题 → 子组件提交 → 校验通过后 resolve ticket", async () => {
    vi.useFakeTimers();
    mocks.challenge.mockResolvedValue({ code: 1000, data: CHALLENGE });
    mocks.verify.mockResolvedValue({
      code: 1000,
      data: { passed: true, ticket: "ticket-1", expires_in: 120 }
    });

    const wrapper = mountChallenge();
    const pending = vmOf(wrapper).open();
    await flushPromises();

    expect(mocks.challenge).toHaveBeenCalledWith({
      scene: "login",
      type: "slide"
    });
    wrapper
      .findComponent({ name: "ReCaptchaPuzzle" })
      .vm.$emit("submit", { answer: { x: 100 }, track: TRACK });
    await flushPromises();

    expect(mocks.verify).toHaveBeenCalledWith({
      challenge_id: "c1",
      type: "slide",
      scene: "login",
      answer: { x: 100 },
      track: TRACK
    });
    vi.advanceTimersByTime(500);
    await flushPromises();
    await expect(pending).resolves.toBe("ticket-1");
  });

  it("校验失败下发剩余次数，可继续提交直到通过", async () => {
    vi.useFakeTimers();
    mocks.challenge.mockResolvedValue({ code: 1000, data: CHALLENGE });
    mocks.verify
      .mockResolvedValueOnce({
        code: 1000,
        data: { passed: false, attempts_left: 2 }
      })
      .mockResolvedValueOnce({
        code: 1000,
        data: { passed: true, ticket: "ticket-2" }
      });

    const wrapper = mountChallenge();
    const pending = vmOf(wrapper).open();
    await flushPromises();
    const child = wrapper.findComponent({ name: "ReCaptchaPuzzle" });

    child.vm.$emit("submit", { answer: { x: 1 }, track: TRACK });
    await flushPromises();
    expect(wrapper.text()).toContain("还可尝试 2 次");
    expect(mocks.verify).toHaveBeenCalledTimes(1);

    child.vm.$emit("submit", { answer: { x: 100 }, track: TRACK });
    await flushPromises();
    vi.advanceTimersByTime(500);
    await flushPromises();
    await expect(pending).resolves.toBe("ticket-2");
  });

  it("用户取消以 captcha-cancelled 拒绝（不留下悬挂 Promise）", async () => {
    mocks.challenge.mockResolvedValue({ code: 1000, data: CHALLENGE });
    const wrapper = mountChallenge();
    const pending = vmOf(wrapper).open();
    await flushPromises();

    vmOf(wrapper).reset();
    await expect(pending).rejects.toThrow("captcha-cancelled");
  });

  it("出题失败展示可读错误，刷新可重试", async () => {
    mocks.challenge
      .mockRejectedValueOnce({ detail: "出题失败" })
      .mockResolvedValueOnce({ code: 1000, data: CHALLENGE });
    const wrapper = mountChallenge();
    void vmOf(wrapper).open();
    await flushPromises();
    expect(wrapper.text()).toContain("出题失败");

    await wrapper.find(".re-captcha-panel__head button").trigger("click");
    await flushPromises();
    expect(mocks.challenge).toHaveBeenCalledTimes(2);
  });
});
