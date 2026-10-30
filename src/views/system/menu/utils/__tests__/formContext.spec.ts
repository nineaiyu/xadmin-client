import { describe, expect, it } from "vitest";
import { menuFormReadonly } from "../formContext";
import type { MenuAuths } from "../types";

function auth(bits: Partial<MenuAuths>): MenuAuths {
  return { ...bits } as MenuAuths;
}

describe("menuFormReadonly", () => {
  it("新增态只看 create：有 create 无 partialUpdate 时表单可编辑", () => {
    // 回归点：曾一律按 partialUpdate 判只读——「有新增权限」的角色能打开
    // 新增抽屉却整表单禁用，等于新增功能不可用
    expect(menuFormReadonly(true, auth({ create: true }))).toBe(false);
  });

  it("新增态没有 create：表单只读", () => {
    expect(menuFormReadonly(true, auth({ partialUpdate: true }))).toBe(true);
  });

  it("编辑态只看 partialUpdate：有 partialUpdate 无 create 时表单可编辑", () => {
    expect(menuFormReadonly(false, auth({ partialUpdate: true }))).toBe(false);
  });

  it("编辑态没有 partialUpdate：表单只读", () => {
    expect(menuFormReadonly(false, auth({ create: true }))).toBe(true);
  });

  it("权限位缺失按只读处理（不因 undefined 放行）", () => {
    expect(menuFormReadonly(true, undefined)).toBe(true);
    expect(menuFormReadonly(false, undefined)).toBe(true);
  });
});
