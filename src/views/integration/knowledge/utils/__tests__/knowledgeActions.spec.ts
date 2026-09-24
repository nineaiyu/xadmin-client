import { describe, expect, it } from "vitest";
import {
  buildKnowledgeActionGroups,
  type KnowledgeActionHandlers
} from "../knowledgeActions";

type Params = Parameters<typeof buildKnowledgeActionGroups>[0];

/** t 仅用于产出稳定断言值：返回键名即可（分组/动作文案均来自 i18n 键） */
const t = ((key: string) => key) as unknown as Params["t"];

const handlers: KnowledgeActionHandlers = {
  toggle: () => undefined,
  remove: () => undefined
};

const fullFlags: Params["flags"] = { canUpdate: true, canDestroy: true };

describe("buildKnowledgeActionGroups", () => {
  it("启用态的上传文档：启停 + 删除两组（动作文案为「停用」）", () => {
    const groups = buildKnowledgeActionGroups({
      t,
      flags: fullFlags,
      target: { isActive: true, removable: true },
      handlers
    });

    expect(groups.map(group => group.key)).toEqual(["retrieval", "danger"]);
    const codes = groups.flatMap(group => group.actions.map(item => item.code));
    expect(codes).toEqual(["toggleActive", "delete"]);

    const toggle = groups[0].actions[0];
    expect(toggle.label).toBe("aiKnowledge.disable");
    // 停用会移除分块、退出问答检索：按谨慎语义提示
    expect(toggle.type).toBe("warning");
  });

  it("停用态动作翻转为「启用」并回到常规语义", () => {
    const groups = buildKnowledgeActionGroups({
      t,
      flags: { canUpdate: true },
      target: { isActive: false, removable: true },
      handlers
    });

    const toggle = groups[0].actions[0];
    expect(toggle.label).toBe("aiKnowledge.enable");
    expect(toggle.type).toBe("primary");
  });

  it("仓库文档不提供删除入口（分组不留空壳）", () => {
    const groups = buildKnowledgeActionGroups({
      t,
      flags: fullFlags,
      target: { isActive: true, removable: false },
      handlers
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("retrieval");
  });

  it("无权限时输出空清单", () => {
    expect(
      buildKnowledgeActionGroups({
        t,
        flags: {},
        target: { isActive: true, removable: true },
        handlers
      })
    ).toEqual([]);
  });
});
