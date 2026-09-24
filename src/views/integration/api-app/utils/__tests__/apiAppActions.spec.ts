import { describe, expect, it } from "vitest";
import {
  buildApiAppActionGroups,
  type ApiAppActionHandlers
} from "../apiAppActions";

type Params = Parameters<typeof buildApiAppActionGroups>[0];

/** t 仅用于产出稳定断言值：返回键名即可（分组/动作文案均来自 i18n 键） */
const t = ((key: string) => key) as unknown as Params["t"];

const handlers: ApiAppActionHandlers = {
  openUsage: () => undefined,
  regenerate: () => undefined,
  testCallback: () => undefined,
  edit: () => undefined
};

const allFlags: Params["flags"] = {
  canStats: true,
  canRegenerate: true,
  canTestCallback: true,
  canEdit: true
};

describe("buildApiAppActionGroups", () => {
  it("全量权限下按接入/联调/配置三组输出且动作齐全", () => {
    const groups = buildApiAppActionGroups({ t, flags: allFlags, handlers });

    expect(groups.map(group => group.key)).toEqual([
      "access",
      "verify",
      "manage"
    ]);
    expect(
      groups.flatMap(group => group.actions.map(item => item.code))
    ).toEqual(["usage", "regenerate", "testCallback", "edit"]);
  });

  it("无任何权限时输出空清单（抽屉只渲染资料）", () => {
    expect(buildApiAppActionGroups({ t, flags: {}, handlers })).toEqual([]);
  });

  it("权限缺失只裁剪对应动作，随之变空的分组一并剔除", () => {
    const groups = buildApiAppActionGroups({
      t,
      flags: { canStats: true },
      handlers
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("access");
    expect(groups[0].actions.map(item => item.code)).toEqual(["usage"]);
  });

  it("重置密钥带谨慎语义（旧凭证立即失效）", () => {
    const groups = buildApiAppActionGroups({ t, flags: allFlags, handlers });
    const typeOf = (code: string) =>
      groups.flatMap(group => group.actions).find(item => item.code === code)
        ?.type;

    expect(typeOf("regenerate")).toBe("warning");
    expect(typeOf("usage")).toBeUndefined();
  });

  it("动作回调按构建期绑定执行", () => {
    const calls: string[] = [];
    const groups = buildApiAppActionGroups({
      t,
      flags: { canEdit: true, canTestCallback: true },
      handlers: {
        ...handlers,
        edit: () => calls.push("edit"),
        testCallback: () => calls.push("testCallback")
      }
    });

    groups.flatMap(group => group.actions).forEach(action => action.run());
    expect(calls).toEqual(["testCallback", "edit"]);
  });
});
