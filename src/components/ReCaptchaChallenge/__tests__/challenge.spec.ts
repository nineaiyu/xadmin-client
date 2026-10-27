import { createHash, createHmac, webcrypto } from "node:crypto";
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
vi.mock("@/components/ReImageCaptcha", () => ({
  ReImageCaptcha: {
    name: "ReImageCaptcha",
    props: ["challenge", "submitting"],
    emits: ["submit"],
    template: "<div class='image-stub' />"
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
        loadFailed: "验证码加载失败，请重试",
        imageFallback: "使用图片验证码"
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

const mountChallenge = (extraProps: Record<string, unknown> = {}) =>
  mount(ReCaptchaChallenge, {
    props: { scene: "login", types: ["slide"], inline: true, ...extraProps },
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
  vi.unstubAllGlobals();
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

    expect(mocks.challenge).toHaveBeenCalledWith(
      expect.objectContaining({ scene: "login", type: "slide" })
    );
    wrapper
      .findComponent({ name: "ReCaptchaPuzzle" })
      .vm.$emit("submit", { answer: { x: 100 }, track: TRACK });
    await flushPromises();

    expect(mocks.verify).toHaveBeenCalledWith(
      expect.objectContaining({
        challenge_id: "c1",
        type: "slide",
        scene: "login",
        answer: { x: 100 },
        track: TRACK,
        input: "pointer"
      })
    );
    vi.advanceTimersByTime(500);
    await flushPromises();
    await expect(pending).resolves.toBe("ticket-1");
  });

  it("校验失败不暴露剩余次数，自动换题后可再次提交", async () => {
    vi.useFakeTimers();
    mocks.challenge.mockResolvedValue({ code: 1000, data: CHALLENGE });
    mocks.verify
      .mockResolvedValueOnce({ code: 1000, data: { passed: false } })
      .mockResolvedValueOnce({
        code: 1000,
        data: { passed: true, ticket: "ticket-2" }
      });

    const wrapper = mountChallenge();
    const pending = vmOf(wrapper).open();
    await flushPromises();
    wrapper
      .findComponent({ name: "ReCaptchaPuzzle" })
      .vm.$emit("submit", { answer: { x: 1 }, track: TRACK });
    await flushPromises();
    expect(mocks.verify).toHaveBeenCalledTimes(1);
    expect(mocks.challenge).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).not.toContain("还可尝试");

    wrapper
      .findComponent({ name: "ReCaptchaPuzzle" })
      .vm.$emit("submit", { answer: { x: 100 }, track: TRACK });
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

  it("图片回退：点击按钮后按 type=image 重新拉题并提交 code+pow_answer", async () => {
    const imageChallenge = {
      challenge_id: "i1",
      type: "image" as const,
      background: "data:image/png;base64,x",
      width: 120,
      height: 40,
      length: 4,
      audio: false,
      ttl: 120
    };
    mocks.challenge.mockResolvedValue({ code: 1000, data: imageChallenge });
    mocks.verify.mockResolvedValue({
      code: 1000,
      data: { passed: true, ticket: "ticket-image" }
    });
    const wrapper = mountChallenge({
      types: ["slide", "image"],
      imageFallback: true
    });
    const pending = vmOf(wrapper).open();
    await flushPromises();
    const fallbackButton = wrapper
      .findAll("button")
      .find(button => button.text().includes("使用图片验证码"));
    await fallbackButton?.trigger("click");
    await flushPromises();
    expect(mocks.challenge).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "image" })
    );
    wrapper.findComponent({ name: "ReImageCaptcha" }).vm.$emit("submit", {
      answer: { code: "1234" },
      track: [],
      input: "keyboard"
    });
    await flushPromises();
    vi.useFakeTimers();
    vi.advanceTimersByTime(500);
    await flushPromises();
    await expect(pending).resolves.toBe("ticket-image");
  });

  it("light/pow：点击验证后求解 PoW 并换票", async () => {
    vi.stubGlobal("crypto", webcrypto);
    mocks.challenge.mockResolvedValue({
      code: 1000,
      data: {
        challenge_id: "p1",
        type: "pow",
        ttl: 120,
        pow: {
          algorithm: "sha256",
          challenge: "abc",
          difficulty_bits: 4,
          expire: 0
        }
      }
    });
    mocks.verify.mockResolvedValue({
      code: 1000,
      data: { passed: true, ticket: "ticket-pow" }
    });
    const wrapper = mountChallenge();
    const pending = vmOf(wrapper).open();
    await flushPromises();
    await wrapper.find('[data-testid="captcha-pow-solve"]').trigger("click");
    await vi.waitFor(() => expect(mocks.verify).toHaveBeenCalledTimes(1), {
      timeout: 3000
    });
    const payload = mocks.verify.mock.calls[0][0];
    expect(payload.type).toBe("pow");
    expect(payload.pow_answer.nonce).toBeDefined();
    vi.useFakeTimers();
    vi.advanceTimersByTime(500);
    await flushPromises();
    await expect(pending).resolves.toBe("ticket-pow");
  });

  it("bind 展示方式：真正挂载到指定容器，而不是弹窗", async () => {
    mocks.challenge.mockResolvedValue({ code: 1000, data: CHALLENGE });
    const target = document.createElement("div");
    target.id = "captcha-bind-slot";
    document.body.appendChild(target);
    const wrapper = mountChallenge({
      inline: false,
      display: "bind",
      target: "#captcha-bind-slot"
    });
    const pending = vmOf(wrapper).open();
    await flushPromises();
    expect(
      document.querySelector("#captcha-bind-slot [data-testid='captcha-bound']")
    ).not.toBeNull();
    expect(wrapper.find(".el-overlay").exists()).toBe(false);
    vmOf(wrapper).reset();
    await expect(pending).rejects.toThrow("captcha-cancelled");
    expect(
      document.querySelector("#captcha-bind-slot [data-testid='captcha-bound']")
    ).toBeNull();
    target.remove();
  });

  it("pow 校验失败换题时不把 type=pow 回传给 challenge", async () => {
    vi.stubGlobal("crypto", webcrypto);
    mocks.challenge.mockResolvedValue({
      code: 1000,
      data: {
        challenge_id: "p-fail",
        type: "pow",
        ttl: 120,
        pow: {
          algorithm: "sha256",
          challenge: "abc",
          difficulty_bits: 4,
          expire: 0
        }
      }
    });
    mocks.verify.mockResolvedValue({ code: 1000, data: { passed: false } });
    const wrapper = mountChallenge();
    void vmOf(wrapper).open();
    await flushPromises();
    await wrapper.find('[data-testid="captcha-pow-solve"]').trigger("click");
    await vi.waitFor(() => expect(mocks.verify).toHaveBeenCalledTimes(1), {
      timeout: 3000
    });
    await vi.waitFor(() => expect(mocks.challenge).toHaveBeenCalledTimes(2), {
      timeout: 3000
    });
    expect(mocks.challenge.mock.calls[1][0].type).not.toBe("pow");
    wrapper.unmount();
  });

  it("float 展示方式：浮层打开并可关闭取消", async () => {
    mocks.challenge.mockResolvedValue({ code: 1000, data: CHALLENGE });
    const wrapper = mountChallenge({ inline: false, display: "float" });
    const pending = vmOf(wrapper).open();
    await flushPromises();
    expect(wrapper.find('[data-testid="captcha-float"]').exists()).toBe(true);
    vmOf(wrapper).reset();
    await expect(pending).rejects.toThrow("captcha-cancelled");
  });

  it("verify 携带意图动作；下发 ck 时附带 gen_time/nonce/sign", async () => {
    vi.stubGlobal("crypto", webcrypto);
    mocks.challenge.mockResolvedValue({
      code: 1000,
      data: { ...CHALLENGE, ck: "ck-session-key" }
    });
    mocks.verify.mockResolvedValue({
      code: 1000,
      data: { passed: true, ticket: "ticket-signed" }
    });

    const wrapper = mountChallenge({ action: "identity.login.basic" });
    void vmOf(wrapper).open();
    await flushPromises();
    const before = Math.floor(Date.now() / 1000);
    wrapper
      .findComponent({ name: "ReCaptchaPuzzle" })
      .vm.$emit("submit", { answer: { x: 100 }, track: TRACK });
    // WebCrypto 完成回调落在线程池 macrotask，需等待 mock 实际被调用
    await vi.waitFor(() => expect(mocks.verify).toHaveBeenCalledTimes(1));
    await flushPromises();

    const payload = mocks.verify.mock.calls[0][0];
    expect(payload.action).toBe("identity.login.basic");
    expect([before, before + 1]).toContain(payload.gen_time);
    expect(payload.nonce).toMatch(/^[0-9a-f]{32}$/);
    const digest = createHash("sha256")
      .update(JSON.stringify({ x: 100 }))
      .digest("hex");
    const expected = createHmac("sha256", "ck-session-key")
      .update(`c1|slide|login|${digest}|${payload.gen_time}`)
      .digest("hex");
    expect(payload.sign).toBe(expected);
    wrapper.unmount();
  });
});
