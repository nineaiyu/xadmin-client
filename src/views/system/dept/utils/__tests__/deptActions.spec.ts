import { describe, expect, it } from "vitest";
import { buildDeptActionGroups, type DeptActionHandlers } from "../deptActions";

type Params = Parameters<typeof buildDeptActionGroups>[0];

/** t 仅用于产出稳定断言值：返回键名即可（分组/动作文案均来自 i18n 键） */
const t = ((key: string) => key) as Params["t"];

const handlers: DeptActionHandlers = {
  assignRoles: () => undefined,
  assignManagers: () => undefined,
  preview: () => undefined,
  viewMembers: () => undefined,
  changeHistory: () => undefined
};

/** 默认权限面：除跨模块开关外的全部本页权限 */
const allAuth: Params["auth"] = {
  empower: true,
  assignManagers: true,
  preview: true,
  changeHistory: true
};

const allFlags: Params["flags"] = { viewMembers: true };

describe("buildDeptActionGroups", () => {
  it("全量权限下按三个语义分组输出且动作齐全", () => {
    const groups = buildDeptActionGroups({
      t,
      auth: allAuth,
      flags: allFlags,
      handlers
    });

    expect(groups.map(group => group.key)).toEqual([
      "permission",
      "member",
      "record"
    ]);
    expect(
      groups.flatMap(group => group.actions.map(action => action.code))
    ).toEqual([
      "empower",
      "preview",
      "assignManagers",
      "viewMembers",
      "changeHistory"
    ]);
  });

  it("无任何权限时输出空清单（抽屉不渲染分组）", () => {
    const groups = buildDeptActionGroups({
      t,
      auth: {},
      flags: {},
      handlers
    });
    expect(groups).toEqual([]);
  });

  it("权限缺失只裁剪对应动作，随之变空的分组一并剔除", () => {
    const groups = buildDeptActionGroups({
      t,
      auth: { preview: true },
      flags: {},
      handlers
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("permission");
    expect(groups[0].actions.map(action => action.code)).toEqual(["preview"]);
  });

  it("跨模块开关独立生效（用户列表权限驱动查看成员）", () => {
    const onlyMembers = buildDeptActionGroups({
      t,
      auth: {},
      flags: { viewMembers: true },
      handlers
    });
    expect(onlyMembers[0].key).toBe("member");
    expect(onlyMembers[0].actions.map(action => action.code)).toEqual([
      "viewMembers"
    ]);
  });

  it("查看成员在部门无成员时不可用", () => {
    const groups = buildDeptActionGroups({
      t,
      auth: {},
      flags: { viewMembers: true },
      handlers
    });
    const viewMembers = groups[0].actions[0];

    expect(viewMembers.disabled?.({ user_count: 0 })).toBe(true);
    expect(viewMembers.disabled?.({})).toBe(true);
    expect(viewMembers.disabled?.({ user_count: 3 })).toBe(false);
  });

  it("动作回调透传当前行数据", () => {
    const calls: Array<[string, unknown]> = [];
    const groups = buildDeptActionGroups({
      t,
      auth: { empower: true },
      flags: {},
      handlers: {
        ...handlers,
        assignRoles: row => calls.push(["assignRoles", row])
      }
    });

    groups[0].actions[0].run({ pk: 1, name: "研发部" });
    expect(calls).toEqual([["assignRoles", { pk: 1, name: "研发部" }]]);
  });
});
