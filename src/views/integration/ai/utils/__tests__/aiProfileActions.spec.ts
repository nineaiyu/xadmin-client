import { describe, expect, it } from "vitest";
import {
  buildAiProfileActionGroups,
  type AiProfileActionHandlers
} from "../aiProfileActions";

type Params = Parameters<typeof buildAiProfileActionGroups>[0];

/** t 仅用于产出稳定断言值：返回键名即可（分组/动作文案均来自 i18n 键） */
const t = ((key: string) => key) as unknown as Params["t"];

const handlers: AiProfileActionHandlers = {
  probe: () => undefined,
  probeVision: () => undefined,
  edit: () => undefined,
  remove: () => undefined
};

const allFlags: Params["flags"] = {
  canProbe: true,
  canEdit: true,
  canDestroy: true
};

describe("buildAiProfileActionGroups", () => {
  it("全量权限下按探测/配置/危险区三组输出且动作齐全", () => {
    const groups = buildAiProfileActionGroups({ t, flags: allFlags, handlers });

    expect(groups.map(group => group.key)).toEqual([
      "probe",
      "manage",
      "danger"
    ]);
    expect(
      groups.flatMap(group => group.actions.map(item => item.code))
    ).toEqual(["probe", "probeVision", "edit", "delete"]);
  });

  it("无任何权限时输出空清单（抽屉只渲染资料与画像）", () => {
    expect(buildAiProfileActionGroups({ t, flags: {}, handlers })).toEqual([]);
  });

  it("缺删除权限时危险区整组剔除（不留空壳）", () => {
    const groups = buildAiProfileActionGroups({
      t,
      flags: { canProbe: true, canEdit: true },
      handlers
    });

    expect(groups.map(group => group.key)).toEqual(["probe", "manage"]);
    expect(
      groups.flatMap(group => group.actions.map(item => item.code))
    ).not.toContain("delete");
  });

  it("删除动作带危险语义", () => {
    const groups = buildAiProfileActionGroups({ t, flags: allFlags, handlers });
    const remove = groups
      .flatMap(group => group.actions)
      .find(item => item.code === "delete");

    expect(remove?.type).toBe("danger");
  });
});
