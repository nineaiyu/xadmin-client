import { describe, expect, it } from "vitest";

import {
  buildFlowPayload,
  createEmptyNode,
  isNumericConditionValue,
  remapRouteTargets,
  toNodeRow,
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

describe("节点抄送人（cc_users）", () => {
  it("编辑回显保留抄送人，保存载荷原样回传", () => {
    const row = toNodeRow({
      name: "会签",
      order: 1,
      cc_users: ["alice", " bob ", ""]
    });

    expect(row.cc_users).toEqual(["alice", "bob"]);

    const payload = buildFlowPayload(basic, [field], [row]);
    expect(payload.nodes[0].cc_users).toEqual(["alice", "bob"]);
  });

  it("接口缺 cc_users 时按空数组回显与提交（不产生 undefined 字段）", () => {
    const row = toNodeRow({ name: "初审", order: 1 });
    expect(row.cc_users).toEqual([]);
    expect(buildFlowPayload(basic, [field], [row]).nodes[0].cc_users).toEqual(
      []
    );
  });

  it("新建节点默认无抄送", () => {
    expect(createEmptyNode().cc_users).toEqual([]);
  });
});

describe("remapRouteTargets（顺序变更）", () => {
  const buildNodes = () => [
    node({ name: "A", routes: [{ condition: {}, target: 2 }] }),
    node({ name: "B", routes: [{ condition: {}, target: 1 }] }),
    node({ name: "C", routes: [] })
  ];

  it("上移/下移后 target 指向同一业务节点", () => {
    const nodes = buildNodes();
    const previous = nodes.slice();
    // A 下移一位：A↔B
    [nodes[0], nodes[1]] = [nodes[1], nodes[0]];
    remapRouteTargets(nodes, previous);

    // A 原本指向 B（旧 order 2）；B 现在 order 1 → A.target 应为 1
    expect(nodes[1].name).toBe("A");
    expect(nodes[1].routes[0].target).toBe(1);
    // B 原本指向 A（旧 order 1）；A 现在 order 2 → B.target 应为 2
    expect(nodes[0].name).toBe("B");
    expect(nodes[0].routes[0].target).toBe(2);
  });

  it("删除目标节点后指向它的路由被丢弃", () => {
    const nodes = buildNodes();
    const previous = nodes.slice();
    // 删除 B（index 1）：A 的 target=2 指向 B，应被丢弃
    nodes.splice(1, 1);
    remapRouteTargets(nodes, previous);

    expect(nodes.map(item => item.name)).toEqual(["A", "C"]);
    expect(nodes[0].routes).toEqual([]);
  });

  it("重映射后形成自环的路由丢弃", () => {
    const nodes = [
      node({ name: "A", routes: [{ condition: {}, target: 2 }] }),
      node({ name: "B" })
    ];
    const previous = nodes.slice();
    // 删除 B：A 唯一的路由目标消失 → 空
    nodes.splice(1, 1);
    remapRouteTargets(nodes, previous);
    expect(nodes[0].routes).toEqual([]);
  });

  it("合法目标保持原顺序语义（未变更时不改动）", () => {
    const nodes = buildNodes();
    const previous = nodes.slice();
    remapRouteTargets(nodes, previous);
    expect(nodes[0].routes[0].target).toBe(2);
    expect(nodes[1].routes[0].target).toBe(1);
  });
});
