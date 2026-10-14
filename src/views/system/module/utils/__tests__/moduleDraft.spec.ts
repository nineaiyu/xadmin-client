import { describe, expect, it } from "vitest";

import {
  buildModulePayload,
  initModuleDraft,
  isModuleDraftDirty,
  moduleLevelKey,
  moduleLevelTagType
} from "../moduleDraft";
import type { SystemModulesData } from "@/api/system/modules";

const PRESETS = [{ value: "full", module_ids: ["chat", "ai"] }];

function payload(): SystemModulesData {
  return {
    preset: "full",
    enabled_count: 2,
    total: 2,
    disabled: [],
    presets: PRESETS.map(item => ({
      ...item,
      label: "全量",
      enabled_count: item.module_ids.length
    })),
    modules: [
      {
        id: "chat",
        label: "聊天室",
        level: "optional",
        depends: [],
        menus: 1,
        routes: 1,
        enabled: true,
        note: ""
      }
    ],
    config_snippet: "",
    effective_config_snippet: "",
    desired: { preset: "full", enabled_count: 2, disabled: [] },
    pending: false,
    diff: { enable: [], disable: [], preset_changed: false },
    override_active: false,
    override_updated_time: null,
    baseline: { preset: "full", enable: [], disable: [] },
    restart_command: "",
    docs: ""
  };
}

describe("模块等级渲染映射", () => {
  it("已声明的三个等级各自映射到词条与标签色", () => {
    expect(moduleLevelKey("core")).toBe("levelCore");
    expect(moduleLevelKey("standard")).toBe("levelStandard");
    expect(moduleLevelKey("optional")).toBe("levelOptional");
    expect(moduleLevelTagType("optional")).toBe("warning");
  });

  it("等级缺省 / 未知时回退，不产出 systemModule.undefined 词条", () => {
    // el-table 挂载帧会以空行占位渲染单元格：row.level 为 undefined
    expect(moduleLevelKey(undefined)).toBe("levelStandard");
    expect(moduleLevelKey("")).toBe("levelStandard");
    expect(moduleLevelKey("unknown")).toBe("levelStandard");
    expect(moduleLevelTagType(undefined)).toBe("info");
    expect(moduleLevelTagType("unknown")).toBe("info");
  });
});

describe("模块草稿语义", () => {
  it("按预设推导增删项；初始草稿不脏，改动后变脏", () => {
    const data = payload();
    const allIds = data.modules.map(row => row.id);
    const draft = initModuleDraft(data);
    expect(draft.preset).toBe("full");
    expect(draft.enabled.has("chat")).toBe(true);

    expect(
      isModuleDraftDirty({
        data,
        draftPreset: draft.preset,
        draftEnabled: draft.enabled,
        allIds,
        presets: PRESETS
      })
    ).toBe(false);

    const next = new Set(draft.enabled);
    next.delete("chat");
    expect(
      isModuleDraftDirty({
        data,
        draftPreset: draft.preset,
        draftEnabled: next,
        allIds,
        presets: PRESETS
      })
    ).toBe(true);

    // 预设默认开启项被关闭 → 落 disable；非默认项开启 → 落 enable
    expect(
      buildModulePayload({
        preset: "full",
        enabled: new Set<string>(),
        allIds,
        presets: PRESETS
      })
    ).toEqual({ preset: "full", enable: [], disable: ["chat"] });
    expect(
      buildModulePayload({
        preset: "core",
        enabled: new Set(["chat"]),
        allIds,
        presets: PRESETS
      })
    ).toEqual({ preset: "core", enable: ["chat"], disable: [] });
  });
});
