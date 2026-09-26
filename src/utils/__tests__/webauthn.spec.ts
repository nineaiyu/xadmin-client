import { afterEach, describe, expect, it } from "vitest";

import {
  b64urlToBuffer,
  bufferToB64url,
  isPasskeySupported
} from "../webauthn";

describe("webauthn utils", () => {
  it("buffer ↔ b64url 往返一致，输出不含 +/= 字符", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 255]);
    const encoded = bufferToB64url(bytes.buffer);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
    expect(Array.from(new Uint8Array(b64urlToBuffer(encoded)))).toEqual(
      Array.from(bytes)
    );
  });

  it("b64urlToBuffer 补齐缺省 padding", () => {
    // base64 "AW==" → 单字节 0x01
    expect(Array.from(new Uint8Array(b64urlToBuffer("AW")))).toEqual([1]);
  });

  it("b64urlToBuffer 兼容 -/_ base64url 变体", () => {
    // [251, 255] 的标准 base64 为 "+/8="，base64url 形态为 "-_8"（含 -/_ 与缺 padding）
    expect(Array.from(new Uint8Array(b64urlToBuffer("-_8")))).toEqual([
      251, 255
    ]);
  });

  it("isPasskeySupported 依 PublicKeyCredential 与 credentials API 探测", () => {
    expect(isPasskeySupported()).toBe(false);

    const descriptor = Object.getOwnPropertyDescriptor(
      navigator,
      "credentials"
    );
    try {
      (
        window as unknown as { PublicKeyCredential: unknown }
      ).PublicKeyCredential = class {};
      expect(isPasskeySupported()).toBe(false);

      Object.defineProperty(navigator, "credentials", {
        configurable: true,
        value: { create: () => undefined, get: () => undefined }
      });
      expect(isPasskeySupported()).toBe(true);

      Object.defineProperty(navigator, "credentials", {
        configurable: true,
        value: { create: () => undefined }
      });
      expect(isPasskeySupported()).toBe(false);
    } finally {
      delete (window as unknown as { PublicKeyCredential?: unknown })
        .PublicKeyCredential;
      if (descriptor)
        Object.defineProperty(navigator, "credentials", descriptor);
    }
  });

  afterEach(() => {
    delete (window as unknown as { PublicKeyCredential?: unknown })
      .PublicKeyCredential;
  });
});
