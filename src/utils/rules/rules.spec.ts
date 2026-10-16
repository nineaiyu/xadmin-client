import { describe, expect, it, vi } from "vitest";
import type { FormItemRule } from "element-plus";

import { buildRepeatPasswordValidator } from "./confirmPassword";
import { buildEmailRule, isEmailAddress } from "./email";
import {
  generateRandomPassword,
  isRuleEnabled,
  PASSWORD_RULE_KEYS,
  passwordRulesCheck
} from "./passwordPolicy";
import { buildPhoneRule, isPhoneNumber } from "./phone";
import { isExternalRoute, isUrl } from "./url";

/** 以回调形态驱动 el-form 规则，取回错误信息（undefined = 通过） */
function runRule(rule: FormItemRule, value: unknown): Error | undefined {
  const validator = rule.validator as (
    rule: unknown,
    value: unknown,
    callback: (error?: Error) => void
  ) => void;
  let error: Error | undefined;
  validator({}, value, (err?: Error) => {
    error = err;
  });
  return error;
}

describe("phone 规则", () => {
  it("判定委托 @pureadmin/utils，不另立标准", () => {
    expect(isPhoneNumber("13812345678")).toBe(true);
    expect(isPhoneNumber("138-1234-5678")).toBe(false);
    expect(isPhoneNumber("12345678901")).toBe(false);
    expect(isPhoneNumber("abc")).toBe(false);
    expect(isPhoneNumber("")).toBe(false);
  });

  it("启用格式校验时拒绝非手机号（用户表单口径）", () => {
    const rule = buildPhoneRule({ formatMessage: "格式错误" });
    expect(runRule(rule, "")).toBeUndefined();
    expect(runRule(rule, "13812345678")).toBeUndefined();
    expect(runRule(rule, "abc")?.message).toBe("格式错误");
  });

  it("关闭格式校验时只认非空（登录/注册页口径）", () => {
    const rule = buildPhoneRule({
      required: true,
      requiredMessage: "请输入手机号",
      formatMessage: "格式错误",
      formatCheck: false
    });
    expect(runRule(rule, "any-input")).toBeUndefined();
    expect(runRule(rule, "")?.message).toBe("请输入手机号");
  });
});

describe("email 规则", () => {
  it("判定委托 @pureadmin/utils", () => {
    expect(isEmailAddress("a@b.com")).toBe(true);
    expect(isEmailAddress("a@b")).toBe(false);
  });

  it("空值在有必填文案时给出必填提示，否则放行（由 required 内置接管）", () => {
    const withRequired = buildEmailRule({
      required: true,
      requiredMessage: "请输入邮箱",
      formatMessage: "邮箱格式错误"
    });
    expect(runRule(withRequired, "")?.message).toBe("请输入邮箱");
    expect(runRule(withRequired, "bad")?.message).toBe("邮箱格式错误");
    expect(runRule(withRequired, "a@b.com")).toBeUndefined();

    const formatOnly = buildEmailRule({ formatMessage: "邮箱格式错误" });
    expect(runRule(formatOnly, "")).toBeUndefined();
    expect(runRule(formatOnly, "bad")?.message).toBe("邮箱格式错误");
  });
});

describe("url 判定", () => {
  it("isUrl 为严格口径（协议限 http(s)，域名或 IPv4）", () => {
    expect(isUrl("https://example.com/a?b=1#c")).toBe(true);
    expect(isUrl("http://192.168.1.1:8080/x")).toBe(true);
    expect(isUrl("example.com")).toBe(true);
    expect(isUrl("ftp://example.com")).toBe(false);
    expect(isUrl("随便一段文字")).toBe(false);
  });

  it("isExternalRoute 为宽松外链口径（兼容 localhost / 多协议 / IPv6）", () => {
    expect(isExternalRoute("localhost:8080")).toBe(true);
    expect(isExternalRoute("ftp://example.com")).toBe(true);
    expect(isExternalRoute("ws://example.com/socket")).toBe(true);
    expect(isExternalRoute("/dashboard/index")).toBe(false);
    expect(isExternalRoute("system/user/index")).toBe(false);
  });
});

describe("确认密码校验器", () => {
  it("必填口径：空值给必填文案，不一致给不一致文案（注册/重置密码页）", () => {
    const validate = buildRepeatPasswordValidator({
      required: true,
      getPassword: () => "Ab1@def",
      requiredMessage: "请再次输入密码",
      mismatchMessage: "两次密码不一致"
    });
    expect(runError(validate, "")?.message).toBe("请再次输入密码");
    expect(runError(validate, "Ab1@de")?.message).toBe("两次密码不一致");
    expect(runError(validate, "Ab1@def")).toBeUndefined();
  });

  it("非必填口径：空值放行，仅比对一致性（改密弹窗）", () => {
    const password = { value: "Ab1@def" };
    const validate = buildRepeatPasswordValidator({
      getPassword: () => password.value,
      mismatchMessage: "两次密码不一致"
    });
    expect(runError(validate, "")).toBeUndefined();
    expect(runError(validate, "other")?.message).toBe("两次密码不一致");
    password.value = "";
    expect(runError(validate, "")).toBeUndefined();
  });
});

/** 驱动裸 validator（确认密码校验器直接返回函数，不是规则对象） */
function runError(
  validate: (
    rule: unknown,
    value: unknown,
    callback: (error?: Error) => void
  ) => void,
  value: unknown
): Error | undefined {
  let error: Error | undefined;
  validate({}, value, (err?: Error) => {
    error = err;
  });
  return error;
}

describe("密码策略（校验与随机生成同源）", () => {
  const FULL_RULES = [
    { key: PASSWORD_RULE_KEYS.MIN_LENGTH, value: 8 },
    { key: PASSWORD_RULE_KEYS.UPPER_CASE, value: 1 },
    { key: PASSWORD_RULE_KEYS.LOWER_CASE, value: 1 },
    { key: PASSWORD_RULE_KEYS.NUMBER, value: 1 },
    { key: PASSWORD_RULE_KEYS.SPECIAL_CHAR, value: 1 }
  ];
  const t = vi.fn((key: string) => key);

  it("规则键集中定义（校验与生成共用同一份字面量）", () => {
    const result = passwordRulesCheck("Ab1@defg", FULL_RULES, t);
    expect(result.result).toBe(true);
    expect(result.msg).toContain("settingPassword.tips");
  });

  it("value=0 视为关闭（isRuleEnabled 与校验分支同判定）", () => {
    const rules = [
      { key: PASSWORD_RULE_KEYS.UPPER_CASE, value: 0 },
      { key: PASSWORD_RULE_KEYS.SPECIAL_CHAR, value: 0 }
    ];
    expect(isRuleEnabled(rules, PASSWORD_RULE_KEYS.UPPER_CASE)).toBe(false);
    expect(isRuleEnabled(rules, PASSWORD_RULE_KEYS.MIN_LENGTH)).toBe(false);
    expect(passwordRulesCheck("abc", rules, t).result).toBe(true);
  });

  it("生成的随机密码必然通过同一份规则校验（同源不变式）", () => {
    for (let i = 0; i < 50; i++) {
      const password = generateRandomPassword(FULL_RULES);
      const { result } = passwordRulesCheck(password, FULL_RULES, t);
      expect(result).toBe(true);
      expect(password.length).toBeGreaterThanOrEqual(12);
    }
  });

  it("未声明类别规则时按大小写 + 数字兜底", () => {
    const password = generateRandomPassword([
      { key: PASSWORD_RULE_KEYS.MIN_LENGTH, value: 8 }
    ]);
    expect(/[A-Z]/.test(password)).toBe(true);
    expect(/[a-z]/.test(password)).toBe(true);
    expect(/\d/.test(password)).toBe(true);
  });
});
