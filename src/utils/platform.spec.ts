import { afterEach, describe, expect, it } from "vitest";

import { detectPlatform, initPlatform } from "./platform";

function setUserAgent(userAgent: string): void {
  Object.defineProperty(window.navigator, "platform", {
    configurable: true,
    value: ""
  });
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: userAgent
  });
}

describe("platform", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-platform");
  });

  it("macOS 识别为 macOs", () => {
    setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    );
    expect(detectPlatform()).toBe("macOs");
  });

  it("非 macOS 归为 window", () => {
    setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
    expect(detectPlatform()).toBe("window");
  });

  it("initPlatform 写入 html 的 data-platform", () => {
    setUserAgent("Mozilla/5.0 (X11; Linux x86_64)");
    initPlatform();
    expect(document.documentElement.dataset.platform).toBe("window");
  });
});
