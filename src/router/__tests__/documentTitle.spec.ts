import { describe, expect, it } from "vitest";

import { resolveMatchedTitle } from "../utils/documentTitle";

const translate = (value: unknown) => String(value).toUpperCase();

describe("resolveMatchedTitle", () => {
  it("取最深层带 title 的匹配路由", () => {
    expect(
      resolveMatchedTitle(
        [
          { meta: { title: "系统" } },
          { meta: {} },
          { meta: { title: "用户管理" } }
        ],
        translate,
        "xAdmin"
      )
    ).toBe("用户管理 | xAdmin");
  });

  it("无平台标题时只返回页面标题；全无 title 返回 null", () => {
    expect(
      resolveMatchedTitle([{ meta: { title: "登录" } }], translate, "")
    ).toBe("登录");
    expect(resolveMatchedTitle([{ meta: {} }], translate, "xAdmin")).toBeNull();
  });
});
