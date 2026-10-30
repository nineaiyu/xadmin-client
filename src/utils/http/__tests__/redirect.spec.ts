import { describe, expect, it } from "vitest";

import {
  loginFallbackUrl,
  moduleDisabledFallbackUrl
} from "@/utils/http/redirect";

describe("动态路由失败兜底地址", () => {
  it("hash 模式保留 # 路由", () => {
    expect(loginFallbackUrl("hash")).toBe("/#/login");
    expect(moduleDisabledFallbackUrl("ai", "hash")).toBe(
      "/#/error/module-disabled?module=ai"
    );
  });

  it("h5 模式使用真实路径（不拼 hash）", () => {
    expect(loginFallbackUrl("h5")).toBe("/login");
    expect(moduleDisabledFallbackUrl("ai", "h5")).toBe(
      "/error/module-disabled?module=ai"
    );
    expect(moduleDisabledFallbackUrl("", "h5")).toBe("/error/module-disabled");
  });
});
