import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  message: vi.fn(),
  register: vi.fn(),
  get: vi.fn(),
  create: vi.fn()
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/utils/message", () => ({ message: mocks.message }));
vi.mock("@/api/system/security", () => ({
  passkeyApi: { register: mocks.register }
}));
vi.mock("@/utils/webauthn", () => ({
  isPasskeySupported: () => true,
  b64urlToBuffer: (value: string) => `buf:${value}`,
  bufferToB64url: (buffer: unknown) => `b64:${String(buffer)}`
}));

import { useWebAuthn } from "./useWebAuthn";

// jsdom 未实现 WebAuthn：注入桩对象承接断言/注册调用
Object.defineProperty(window.navigator, "credentials", {
  value: { get: mocks.get, create: mocks.create },
  configurable: true
});

describe("useWebAuthn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("assertPasskey", () => {
    it("取挑战 → credentials.get → 组装四字段断言载荷", async () => {
      mocks.get.mockResolvedValue({
        id: "cred-1",
        response: {
          clientDataJSON: "cdj",
          authenticatorData: "authData",
          signature: "sig"
        }
      });
      const { assertPasskey } = useWebAuthn();

      const payload = await assertPasskey({
        challengeApi: async () => ({
          code: 1000,
          detail: "ok",
          data: { challenge: "chal", rp_id: "rp.example.com" }
        })
      });

      expect(payload).toEqual({
        credential_id: "cred-1",
        client_data_json: "b64:cdj",
        authenticator_data: "b64:authData",
        signature: "b64:sig"
      });
      const options = mocks.get.mock.calls[0][0].publicKey;
      expect(options.challenge).toBe("buf:chal");
      expect(options.rpId).toBe("rp.example.com");
    });

    it("挑战返回非成功码：提示 detail 并返回 null", async () => {
      const { assertPasskey } = useWebAuthn();
      const payload = await assertPasskey({
        challengeApi: async () => ({
          code: 1001,
          detail: "no",
          data: { challenge: "", rp_id: "" }
        })
      });
      expect(payload).toBeNull();
      expect(mocks.message).toHaveBeenCalledWith("no", { type: "warning" });
      expect(mocks.get).not.toHaveBeenCalled();
    });

    it("浏览器未返回凭据：提示失败并返回 null", async () => {
      mocks.get.mockResolvedValue(null);
      const { assertPasskey } = useWebAuthn();
      const payload = await assertPasskey({
        challengeApi: async () => ({
          code: 1000,
          data: { challenge: "chal", rp_id: "rp.example.com" }
        })
      });
      expect(payload).toBeNull();
      expect(mocks.message).toHaveBeenCalledWith("passkey.failed", {
        type: "warning"
      });
    });
  });

  describe("registerPasskey", () => {
    it("取注册挑战 → credentials.create → 提交证明并成功提示", async () => {
      mocks.create.mockResolvedValue({
        response: { clientDataJSON: "cdj", attestationObject: "att" }
      });
      mocks.register.mockResolvedValue({ code: 1000, detail: "ok" });
      const { registerPasskey } = useWebAuthn();

      const ok = await registerPasskey({
        challengeApi: async () => ({
          code: 1000,
          data: {
            challenge: "chal",
            rp_id: "admin.example.com",
            rp_name: "Xadmin 控制台",
            user_id: "u1",
            username: "alice",
            display_name: "Alice"
          }
        }),
        name: "my key"
      });

      expect(ok).toBe(true);
      const options = mocks.create.mock.calls[0][0].publicKey;
      expect(options.rp).toEqual({
        id: "admin.example.com",
        name: "Xadmin 控制台"
      });
      expect(mocks.register).toHaveBeenCalledWith({
        client_data_json: "b64:cdj",
        attestation_object: "b64:att",
        name: "my key"
      });
    });

    it("rp_name 缺失时回落 rp_id，名称缺省回落到默认文案", async () => {
      mocks.create.mockResolvedValue({
        response: { clientDataJSON: "cdj", attestationObject: "att" }
      });
      mocks.register.mockResolvedValue({ code: 1000, detail: "ok" });
      const { registerPasskey } = useWebAuthn();

      await registerPasskey({
        challengeApi: async () => ({
          code: 1000,
          data: {
            challenge: "chal",
            rp_id: "admin.example.com",
            user_id: "u1",
            username: "alice",
            display_name: "Alice"
          }
        })
      });

      const options = mocks.create.mock.calls[0][0].publicKey;
      expect(options.rp).toEqual({
        id: "admin.example.com",
        name: "admin.example.com"
      });
      expect(mocks.register).toHaveBeenCalledWith(
        expect.objectContaining({ name: "passkey.name" })
      );
    });

    it("注册提交失败：返回 false 并提示 detail", async () => {
      mocks.create.mockResolvedValue({
        response: { clientDataJSON: "cdj", attestationObject: "att" }
      });
      mocks.register.mockResolvedValue({ code: 1001, detail: "dup" });
      const { registerPasskey } = useWebAuthn();

      const ok = await registerPasskey({
        challengeApi: async () => ({
          code: 1000,
          data: {
            challenge: "chal",
            rp_id: "r",
            user_id: "u1",
            username: "alice",
            display_name: "Alice"
          }
        })
      });

      expect(ok).toBe(false);
      expect(mocks.message).toHaveBeenCalledWith("dup", { type: "error" });
    });
  });
});
