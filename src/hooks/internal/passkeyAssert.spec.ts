import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPasskeyAssert } from "./passkeyAssert";

const mocks = vi.hoisted(() => ({ message: vi.fn() }));

vi.mock("@/utils/message", () => ({ message: mocks.message }));
vi.mock("@/utils/webauthn", () => ({
  isPasskeySupported: vi.fn(() => true),
  b64urlToBuffer: (value: string) => new TextEncoder().encode(value).buffer,
  bufferToB64url: (value: ArrayBuffer) =>
    Buffer.from(value).toString("base64url")
}));

import { isPasskeySupported } from "@/utils/webauthn";

const t = ((key: string) => key) as never;

function payload() {
  return {
    id: "cred-1",
    response: {
      clientDataJSON: new TextEncoder().encode("client").buffer,
      authenticatorData: new TextEncoder().encode("auth").buffer,
      signature: new TextEncoder().encode("sig").buffer
    }
  };
}

beforeEach(() => {
  mocks.message.mockReset();
  vi.mocked(isPasskeySupported).mockReturnValue(true);
  Object.defineProperty(window.navigator, "credentials", {
    value: { get: vi.fn().mockResolvedValue(payload()) },
    configurable: true
  });
});

describe("createPasskeyAssert", () => {
  it("挑战成功且用户完成断言时返回载荷", async () => {
    const assertPasskey = createPasskeyAssert(t);
    const result = await assertPasskey({
      challengeApi: async () =>
        ({
          code: 1000,
          data: { challenge: "abc", rp_id: "localhost" }
        }) as never
    });
    expect(result).toMatchObject({
      credential_id: "cred-1",
      client_data_json: expect.any(String),
      authenticator_data: expect.any(String),
      signature: expect.any(String)
    });
  });

  it("不支持 Passkey 时提示并返回 null", async () => {
    vi.mocked(isPasskeySupported).mockReturnValue(false);
    const assertPasskey = createPasskeyAssert(t);
    await expect(assertPasskey({ challengeApi: vi.fn() })).resolves.toBeNull();
    expect(mocks.message).toHaveBeenCalledWith("passkey.unsupported", {
      type: "warning"
    });
  });

  it("挑战失败时提示并返回 null", async () => {
    const assertPasskey = createPasskeyAssert(t);
    const result = await assertPasskey({
      challengeApi: async () => ({ code: 1001, detail: "no" }) as never
    });
    expect(result).toBeNull();
    expect(mocks.message).toHaveBeenCalledWith("no", { type: "warning" });
  });

  it("用户取消（credentials.get 返回 null）时提示并返回 null", async () => {
    Object.defineProperty(window.navigator, "credentials", {
      value: { get: vi.fn().mockResolvedValue(null) },
      configurable: true
    });
    const assertPasskey = createPasskeyAssert(t);
    await expect(
      assertPasskey({
        challengeApi: async () =>
          ({
            code: 1000,
            data: { challenge: "abc", rp_id: "localhost" }
          }) as never
      })
    ).resolves.toBeNull();
    expect(mocks.message).toHaveBeenCalledWith("passkey.failed", {
      type: "warning"
    });
  });
});
