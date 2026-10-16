import { describe, expect, it } from "vitest";

import { resolveComponentKey } from "./resolve-component";

const KEYS = [
  "/src/views/settings/message/components/MessageTemplatePanel.vue",
  "/src/views/settings/message/index.vue",
  "/src/views/settings/security/index.vue",
  "/src/views/system/user/index.vue",
  "/src/views/system/notice/index.vue",
  "/src/views/welcome/index.vue"
];

describe("resolveComponentKey", () => {
  it("目录下存在排序更靠前的其它文件时，命中目录 index 而非劫持文件", () => {
    expect(resolveComponentKey("settings/message", KEYS)).toBe(
      KEYS.indexOf("/src/views/settings/message/index.vue")
    );
  });

  it("命中结果不受 keys 顺序影响", () => {
    const reversed = [...KEYS].reverse();
    expect(resolveComponentKey("settings/message", reversed)).toBe(
      reversed.indexOf("/src/views/settings/message/index.vue")
    );
  });

  it("显式 /index 片段精确命中", () => {
    expect(resolveComponentKey("settings/security/index", KEYS)).toBe(
      KEYS.indexOf("/src/views/settings/security/index.vue")
    );
  });

  it("带扩展名与 /src/views 前缀均精确命中", () => {
    expect(resolveComponentKey("/src/views/welcome/index.vue", KEYS)).toBe(
      KEYS.indexOf("/src/views/welcome/index.vue")
    );
  });

  it("无 component 时用 path 兜底（前导斜杠归一）", () => {
    expect(resolveComponentKey("/system/user", KEYS)).toBe(
      KEYS.indexOf("/src/views/system/user/index.vue")
    );
  });

  it("精确未命中时退化为历史包含匹配", () => {
    expect(resolveComponentKey("views/system/notice", KEYS)).toBe(
      KEYS.indexOf("/src/views/system/notice/index.vue")
    );
  });

  it("不存在与空值返回 -1", () => {
    expect(resolveComponentKey("system/notify/index", KEYS)).toBe(-1);
    expect(resolveComponentKey("", KEYS)).toBe(-1);
    expect(resolveComponentKey(undefined, KEYS)).toBe(-1);
  });
});
