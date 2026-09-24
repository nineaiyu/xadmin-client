import { describe, expect, it } from "vitest";
import { buildUserActionGroups, type UserActionHandlers } from "../userActions";

type Params = Parameters<typeof buildUserActionGroups>[0];

/** t 仅用于产出稳定断言值：返回键名即可（分组/动作文案均来自 i18n 键） */
const t = ((key: string) => key) as unknown as Params["t"];

const handlers: UserActionHandlers = {
  resetPassword: () => undefined,
  uploadAvatar: () => undefined,
  resetMfa: () => undefined,
  logout: () => undefined,
  assignRoles: () => undefined,
  preview: () => undefined,
  invite: () => undefined,
  sendNotice: () => undefined,
  imBinding: () => undefined,
  assignTags: () => undefined,
  changeHistory: () => undefined
};

/** 默认权限面：除跨模块开关外的全部本页权限 */
const allAuth: Params["auth"] = {
  logout: true,
  upload: true,
  resetPassword: true,
  empower: true,
  resetMfa: true,
  preview: true,
  imBinding: true,
  invite: true,
  changeHistory: true
};

const allFlags: Params["flags"] = { sendNotice: true, assignTags: true };

describe("buildUserActionGroups", () => {
  it("全量权限下按五个语义分组输出且动作齐全", () => {
    const groups = buildUserActionGroups({
      t,
      auth: allAuth,
      flags: allFlags,
      handlers
    });

    expect(groups.map(group => group.key)).toEqual([
      "account",
      "permission",
      "lifecycle",
      "collaboration",
      "record"
    ]);
    expect(
      groups.flatMap(group => group.actions.map(action => action.code))
    ).toEqual([
      "resetPassword",
      "resetMfa",
      "upload",
      "logout",
      "empower",
      "preview",
      "invite",
      "sendNotice",
      "imBinding",
      "tags",
      "changeHistory"
    ]);
  });

  it("无任何权限时输出空清单（抽屉不渲染分组）", () => {
    const groups = buildUserActionGroups({
      t,
      auth: {},
      flags: {},
      handlers
    });
    expect(groups).toEqual([]);
  });

  it("权限缺失只裁剪对应动作，随之变空的分组一并剔除", () => {
    const groups = buildUserActionGroups({
      t,
      auth: { preview: true },
      flags: {},
      handlers
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("permission");
    expect(groups[0].actions.map(action => action.code)).toEqual(["preview"]);
  });

  it("跨模块开关独立生效（通知创建 / 标签授予）", () => {
    const onlyNotice = buildUserActionGroups({
      t,
      auth: {},
      flags: { sendNotice: true },
      handlers
    });
    expect(onlyNotice[0].key).toBe("collaboration");
    expect(onlyNotice[0].actions.map(action => action.code)).toEqual([
      "sendNotice"
    ]);

    const onlyTags = buildUserActionGroups({
      t,
      auth: {},
      flags: { assignTags: true },
      handlers
    });
    expect(onlyTags[0].actions.map(action => action.code)).toEqual(["tags"]);
  });

  it("强制下线在无在线会话时不可用", () => {
    const groups = buildUserActionGroups({
      t,
      auth: { logout: true },
      flags: {},
      handlers
    });
    const logout = groups[0].actions[0];

    expect(logout.disabled?.({ online_count: 0 })).toBe(true);
    expect(logout.disabled?.({})).toBe(true);
    expect(logout.disabled?.({ online_count: 2 })).toBe(false);
  });

  it("高危与谨慎动作带语义色标注", () => {
    const groups = buildUserActionGroups({
      t,
      auth: allAuth,
      flags: allFlags,
      handlers
    });
    const typeOf = (code: string) =>
      groups.flatMap(group => group.actions).find(item => item.code === code)
        ?.type;

    expect(typeOf("logout")).toBe("danger");
    expect(typeOf("resetMfa")).toBe("warning");
    expect(typeOf("invite")).toBe("warning");
    expect(typeOf("resetPassword")).toBeUndefined();
  });

  it("动作回调透传当前行数据", () => {
    const calls: Array<[string, unknown]> = [];
    const groups = buildUserActionGroups({
      t,
      auth: { resetPassword: true },
      flags: {},
      handlers: {
        ...handlers,
        resetPassword: row => calls.push(["resetPassword", row])
      }
    });

    groups[0].actions[0].run({ pk: 1, username: "demo" });
    expect(calls).toEqual([["resetPassword", { pk: 1, username: "demo" }]]);
  });
});
