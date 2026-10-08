import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref, computed } from "vue";
import { mount } from "@vue/test-utils";

const mocks = vi.hoisted(() => ({
  message: vi.fn(),
  assertPasskey: vi.fn()
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/utils/message", () => ({ message: mocks.message }));
vi.mock("@/hooks/useWebAuthn", () => ({
  useWebAuthn: () => ({ assertPasskey: mocks.assertPasskey })
}));
// 冷却用轻量桩替换：真实实现建立 interval，测试只需断言 start 收到的秒数
vi.mock("@/hooks/useCountdownCooldown", async () => {
  const { ref } = await import("vue");
  return {
    useCountdownCooldown: () => {
      const cooldown = ref(0);
      return {
        cooldown,
        start: (seconds: number) => {
          cooldown.value = seconds;
        }
      };
    }
  };
});

import { MFA_CODE_COOLDOWN_SECONDS, useMfaVerify } from "./useMfaVerify";

/** 组合式函数需要组件上下文（onBeforeUnmount），用最小宿主承载 */
function mountHost(
  options: Parameters<typeof useMfaVerify>[0]
): ReturnType<typeof useMfaVerify> {
  let api!: ReturnType<typeof useMfaVerify>;
  const Host = defineComponent({
    setup() {
      api = useMfaVerify(options);
      return () => h("div");
    }
  });
  mount(Host);
  return api;
}

const method = (name: string) => ({
  name,
  display_name: name,
  placeholder: "",
  challenge_required: name !== "passkey"
});

const successVerify = { code: 1000, detail: "ok", data: { expire_at: 111 } };
const failVerify = { code: 1001, detail: "bad code", data: undefined };

describe("useMfaVerify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("默认选中首个方式；方式清单异步到达后回落到首个", async () => {
    const methods = ref([method("otp"), method("sms")]);
    const api = mountHost({
      methods,
      sendCode: vi.fn(),
      verify: vi.fn(),
      passkeyChallenge: vi.fn(),
      onSuccess: vi.fn()
    });
    expect(api.currentMethod.value).toBe("otp");

    // 确认弹窗场景：清单晚到（先为[]再填充）
    methods.value = [];
    await nextTick();
    expect(api.currentMethod.value).toBe("");
    methods.value = [method("sms"), method("email")];
    await nextTick();
    expect(api.currentMethod.value).toBe("sms");

    // 已选方式仍在清单中则不重置
    methods.value = [method("sms"), method("email"), method("otp")];
    await nextTick();
    expect(api.currentMethod.value).toBe("sms");
  });

  it("发码成功：提示 + 冷却从共用常量起；失败：warning 且不冷却", async () => {
    const sendCode = vi.fn().mockResolvedValue({ code: 1000, detail: "" });
    const api = mountHost({
      methods: computed(() => [method("sms")]),
      sendCode,
      verify: vi.fn(),
      passkeyChallenge: vi.fn(),
      onSuccess: vi.fn()
    });

    api.handleSendCode();
    await vi.waitFor(() => expect(api.sendCooldown.value).toBeGreaterThan(0));
    expect(sendCode).toHaveBeenCalledWith("sms");
    expect(api.sendCooldown.value).toBe(MFA_CODE_COOLDOWN_SECONDS);
    expect(mocks.message).toHaveBeenCalledWith("mfa.codeSent", {
      type: "success"
    });
    api.sendCooldown.value = 0;

    vi.clearAllMocks();
    sendCode.mockResolvedValue({ code: 1001, detail: "发送失败" });
    api.handleSendCode();
    await vi.waitFor(() =>
      expect(mocks.message).toHaveBeenCalledWith("发送失败", {
        type: "warning"
      })
    );
    expect(api.sendCooldown.value).toBe(0);
  });

  it("submitCode：空码就地提示不请求；成功触发 onSuccess；业务失败提示 detail", async () => {
    const verify = vi
      .fn()
      .mockResolvedValueOnce(successVerify)
      .mockResolvedValueOnce(failVerify);
    const onSuccess = vi.fn();
    const api = mountHost({
      methods: computed(() => [method("otp")]),
      sendCode: vi.fn(),
      verify,
      passkeyChallenge: vi.fn(),
      onSuccess
    });

    api.submitCode();
    expect(verify).not.toHaveBeenCalled();
    expect(mocks.message).toHaveBeenCalledWith("mfa.codeRequired", {
      type: "warning"
    });

    api.code.value = "123456";
    api.submitCode();
    await vi.waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith(successVerify)
    );
    expect(verify).toHaveBeenCalledWith("otp", "123456");
    expect(api.loading.value).toBe(false);

    api.submitCode();
    await vi.waitFor(() =>
      expect(mocks.message).toHaveBeenCalledWith("bad code", {
        type: "warning"
      })
    );
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("handleVerify：passkey 方式走断言链路，断言载荷 JSON 作为 code 提交", async () => {
    const payload = {
      credential_id: "cred-1",
      client_data_json: "cdj",
      authenticator_data: "authData",
      signature: "sig"
    };
    mocks.assertPasskey.mockResolvedValue(payload);
    const passkeyChallenge = vi.fn();
    const verify = vi.fn().mockResolvedValue(successVerify);
    const onSuccess = vi.fn();
    const api = mountHost({
      methods: computed(() => [method("passkey")]),
      sendCode: vi.fn(),
      verify,
      passkeyChallenge,
      onSuccess
    });

    expect(api.isPasskey.value).toBe(true);
    api.handleVerify();
    await vi.waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith(successVerify)
    );
    expect(mocks.assertPasskey).toHaveBeenCalledWith({
      challengeApi: passkeyChallenge
    });
    expect(verify).toHaveBeenCalledWith("passkey", JSON.stringify(payload));
    expect(api.loading.value).toBe(false);
  });

  it("handleVerify：Passkey 断言取消（返回 null）不落验证请求", async () => {
    mocks.assertPasskey.mockResolvedValue(null);
    const verify = vi.fn();
    const api = mountHost({
      methods: computed(() => [method("passkey")]),
      sendCode: vi.fn(),
      verify,
      passkeyChallenge: vi.fn(),
      onSuccess: vi.fn()
    });

    api.handleVerify();
    await vi.waitFor(() => expect(api.loading.value).toBe(false));
    expect(verify).not.toHaveBeenCalled();
  });

  it("submitCode：请求异常（http 层已提示）不抛出且复位 loading", async () => {
    const verify = vi.fn().mockRejectedValue(new Error("network"));
    const api = mountHost({
      methods: computed(() => [method("otp")]),
      sendCode: vi.fn(),
      verify,
      passkeyChallenge: vi.fn(),
      onSuccess: vi.fn()
    });

    api.code.value = "654321";
    api.submitCode();
    await vi.waitFor(() => expect(api.loading.value).toBe(false));
    expect(mocks.message).not.toHaveBeenCalledWith("network", {
      type: "warning"
    });
  });
});
