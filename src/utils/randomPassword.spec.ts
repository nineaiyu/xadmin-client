import { describe, expect, it } from "vitest";

import { passwordRulesCheck } from "./index";
import { generateRandomPassword } from "./randomPassword";

const t = (key: string) => key;

const FULL_RULES = [
  { key: "SECURITY_PASSWORD_MIN_LENGTH", value: 8 },
  { key: "SECURITY_PASSWORD_UPPER_CASE", value: 1 },
  { key: "SECURITY_PASSWORD_LOWER_CASE", value: 1 },
  { key: "SECURITY_PASSWORD_NUMBER", value: 1 },
  { key: "SECURITY_PASSWORD_SPECIAL_CHAR", value: 1 }
];

describe("generateRandomPassword", () => {
  it("生成的密码必然通过安全策略校验（100 次采样）", () => {
    for (let i = 0; i < 100; i++) {
      const password = generateRandomPassword(FULL_RULES);
      const { result } = passwordRulesCheck(password, FULL_RULES, t);
      expect(result).toBe(true);
      expect(password.length).toBeGreaterThanOrEqual(12);
    }
  });

  it("规则关闭时不强制特殊字符，但保留大小写与数字基础强度", () => {
    const rules = [
      { key: "SECURITY_PASSWORD_MIN_LENGTH", value: 8 },
      { key: "SECURITY_PASSWORD_UPPER_CASE", value: 1 },
      { key: "SECURITY_PASSWORD_LOWER_CASE", value: 1 },
      { key: "SECURITY_PASSWORD_NUMBER", value: 1 },
      { key: "SECURITY_PASSWORD_SPECIAL_CHAR", value: 0 }
    ];
    const password = generateRandomPassword(rules);
    expect(/[A-Z]/.test(password)).toBe(true);
    expect(/[a-z]/.test(password)).toBe(true);
    expect(/\d/.test(password)).toBe(true);
  });

  it("min_length 生效且长度有上限", () => {
    expect(
      generateRandomPassword([
        { key: "SECURITY_PASSWORD_MIN_LENGTH", value: 20 }
      ]).length
    ).toBe(20);
    expect(
      generateRandomPassword([
        { key: "SECURITY_PASSWORD_MIN_LENGTH", value: 99 }
      ]).length
    ).toBe(32);
  });

  it("无规则时默认长度 12 且包含大小写与数字", () => {
    const password = generateRandomPassword([]);
    expect(password.length).toBe(12);
    expect(/[A-Z]/.test(password)).toBe(true);
    expect(/[a-z]/.test(password)).toBe(true);
    expect(/\d/.test(password)).toBe(true);
  });
});
