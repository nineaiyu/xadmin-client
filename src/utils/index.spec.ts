import { describe, expect, it, vi } from "vitest";

import {
  getMenuFromPk,
  getMenuOrderPk,
  passwordRulesCheck,
  wordLowerCase,
  wordMinLength,
  wordNumber,
  wordSpecialChar,
  wordUpperCase
} from "./index";

describe("getMenuOrderPk", () => {
  it("嵌套 children 前序收集 pk", () => {
    const data = [
      { pk: 1, children: [{ pk: 2 }, { pk: 3, children: [{ pk: 4 }] }] },
      { pk: 5 }
    ];
    expect(getMenuOrderPk(data)).toEqual([1, 2, 3, 4, 5]);
  });

  it("含空 children 数组的节点", () => {
    const data = [{ pk: 1, children: [] }, { pk: 2 }];
    expect(getMenuOrderPk(data)).toEqual([1, 2]);
  });

  it("非数组入参返回传入的 x", () => {
    expect(getMenuOrderPk(undefined)).toEqual([]);
    expect(getMenuOrderPk(null)).toEqual([]);
    expect(getMenuOrderPk({})).toEqual([]);
    const x = [99];
    expect(getMenuOrderPk(undefined, x)).toBe(x);
  });
});

describe("getMenuFromPk", () => {
  const tree = [
    {
      pk: 1,
      parent: 0,
      children: [{ pk: 11, parent: 1, children: [{ pk: 111, parent: 11 }] }]
    },
    { pk: 2, parent: 0 }
  ];

  it("叶子 pk 返回叶子到根的祖先链", () => {
    const ancestors = getMenuFromPk(tree, 111);
    expect(ancestors.map(m => m.pk)).toEqual([111, 11, 1]);
  });

  it("未找到的 pk 返回空数组", () => {
    expect(getMenuFromPk(tree, 999)).toEqual([]);
  });
});

describe("word 校验函数", () => {
  it("wordMinLength 满足与不满足", () => {
    expect(wordMinLength("abcde", 5)).not.toBeNull();
    expect(wordMinLength("abcd", 5)).toBeNull();
  });

  it("wordUpperCase 含/不含大写字母", () => {
    expect(wordUpperCase("aBc")).not.toBeNull();
    expect(wordUpperCase("abc")).toBeNull();
  });

  it("wordLowerCase 含/不含小写字母", () => {
    expect(wordLowerCase("aBc")).not.toBeNull();
    expect(wordLowerCase("ABC")).toBeNull();
  });

  it("wordNumber 含/不含数字", () => {
    expect(wordNumber("a1b")).not.toBeNull();
    expect(wordNumber("abc")).toBeNull();
  });

  it("wordSpecialChar 含/不含特殊字符", () => {
    expect(wordSpecialChar("a@b")).not.toBeNull();
    expect(wordSpecialChar("ab")).toBeNull();
  });
});

describe("passwordRulesCheck", () => {
  it("全部规则满足返回 result=true", () => {
    const rules = [
      { key: "SECURITY_PASSWORD_MIN_LENGTH", value: 4 },
      { key: "SECURITY_PASSWORD_UPPER_CASE", value: 1 },
      { key: "SECURITY_PASSWORD_LOWER_CASE", value: 1 },
      { key: "SECURITY_PASSWORD_NUMBER", value: 1 },
      { key: "SECURITY_PASSWORD_SPECIAL_CHAR", value: 1 }
    ];
    const t = vi.fn((key: string) => key);
    const { result, msg } = passwordRulesCheck("Ab1@def", rules, t);
    expect(result).toBe(true);
    expect(msg).toContain("settingPassword.tips");
  });

  it("规则不满足返回 result=false", () => {
    const rules = [
      { key: "SECURITY_PASSWORD_MIN_LENGTH", value: 8 },
      { key: "SECURITY_PASSWORD_UPPER_CASE", value: 1 }
    ];
    const t = vi.fn((key: string) => key);
    const { result } = passwordRulesCheck("abcdefg", rules, t);
    expect(result).toBe(false);
  });

  it("value=0 的规则被跳过不参与短路", () => {
    const rules = [
      { key: "SECURITY_PASSWORD_UPPER_CASE", value: 0 },
      { key: "SECURITY_PASSWORD_SPECIAL_CHAR", value: 0 }
    ];
    const t = vi.fn((key: string) => key);
    const { result } = passwordRulesCheck("abc", rules, t);
    expect(result).toBe(true);
  });
});
