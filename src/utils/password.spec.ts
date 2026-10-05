import { describe, expect, it, vi } from "vitest";

import { passwordRulesCheck } from "./password";

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

  it("特殊字符规则单独不满足时返回 false", () => {
    const rules = [{ key: "SECURITY_PASSWORD_SPECIAL_CHAR", value: 1 }];
    const t = vi.fn((key: string) => key);
    const { result } = passwordRulesCheck("Abcdefg1", rules, t);
    expect(result).toBe(false);
  });
});
