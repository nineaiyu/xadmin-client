import { describe, expect, it } from "vitest";

import {
  buildFlowPayload,
  createEmptyNode,
  isNumericConditionValue,
  validateFlowConfig
} from "../flowConfig";

const basic = { name: "请假流程", code: "leave_x", is_active: true };

const field = {
  label: "天数",
  key: "days",
  type: "number",
  required: true,
  options: ""
};

const node = (overrides: Record<string, unknown> = {}) => ({
  ...createEmptyNode(),
  name: "初审",
  assignee_value: "alice",
  ...overrides
});

describe("isNumericConditionValue", () => {
  it("数值运算符接受数字与数字字符串，拒绝空串与非数字", () => {
    expect(isNumericConditionValue("gte", "1000")).toBe(true);
    expect(isNumericConditionValue("lt", " 2.5 ")).toBe(true);
    expect(isNumericConditionValue("gt", "")).toBe(false);
    expect(isNumericConditionValue("gt", "abc")).toBe(false);
  });

  it("非数值运算符不参与该校验", () => {
    expect(isNumericConditionValue("eq", "abc")).toBe(true);
    expect(isNumericConditionValue("in", "")).toBe(true);
  });
});

describe("validateFlowConfig", () => {
  it("通过合法配置", () => {
    expect(validateFlowConfig(basic, [node()])).toBeNull();
  });

  it("节点条件的数值运算符配错值时给出可读提示", () => {
    const bad = node({
      condition_field: "days",
      condition_op: "gte",
      condition_value: "三天"
    });
    expect(validateFlowConfig(basic, [bad])).toBe(
      "systemApprovalFlow.conditionValueNumericRequired"
    );
  });

  it("出口路由的数值条件同口径校验", () => {
    const ok = node({
      routes: [
        { condition: { field: "days", op: "lt", value: "3" }, target: 2 }
      ]
    });
    expect(validateFlowConfig(basic, [ok])).toBeNull();

    const bad = node({
      routes: [
        { condition: { field: "days", op: "lt", value: "三天" }, target: 2 }
      ]
    });
    expect(validateFlowConfig(basic, [bad])).toBe(
      "systemApprovalFlow.conditionValueNumericRequired"
    );
  });
});

describe("buildFlowPayload", () => {
  it("编辑时携带乐观锁基线，新增不携带", () => {
    const withBaseline = buildFlowPayload(
      basic,
      [field],
      [node()],
      "2026-10-05 10:00:00"
    );
    expect(withBaseline["base_updated_time"]).toBe("2026-10-05 10:00:00");

    const withoutBaseline = buildFlowPayload(basic, [field], [node()]);
    expect("base_updated_time" in withoutBaseline).toBe(false);
  });

  it("数值条件值转数值提交，非法值原样保留交由校验拦截", () => {
    const payload = buildFlowPayload(
      basic,
      [field],
      [
        node({
          condition_field: "days",
          condition_op: "gte",
          condition_value: " 3 "
        })
      ]
    );
    expect(payload.nodes[0].condition).toEqual({
      field: "days",
      op: "gte",
      value: 3
    });
  });
});
