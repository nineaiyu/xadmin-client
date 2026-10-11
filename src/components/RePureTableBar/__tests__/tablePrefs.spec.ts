import { beforeEach, describe, expect, it, vi } from "vitest";

/** 本地存储替身：响应式存储的读写语义（set 存串、getData 自动 JSON.parse） */
const hoisted = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  setSiteConfig: vi.fn()
}));

vi.mock("responsive-storage", () => ({
  default: {
    set: (key: string, value: unknown) => {
      hoisted.store.set(key, value);
    },
    getData: (key: string, nameSpace?: string) => {
      const raw = hoisted.store.get(`${nameSpace ?? ""}${key}`);
      if (raw === undefined) return undefined;
      try {
        return JSON.parse(String(raw));
      } catch {
        return raw;
      }
    }
  }
}));

vi.mock("@/api/config", () => ({
  configApi: {
    setSiteConfig: hoisted.setSiteConfig
  }
}));

import { applyTablePrefs } from "../src/tablePrefsApply";
import { createTablePrefsStorage } from "../src/tablePrefsStorage";
import {
  buildRenderClass,
  rendTippyProps,
  resolveFixedState,
  toggleRowExpansionAll,
  type ExpandableTableInstance,
  type TableColumnLike,
  type TableRowLike
} from "../src/utils";

const makeStorage = () => {
  const syncConfig = vi.fn();
  const storage = createTablePrefsStorage({ nameSpace: "xadmin_", syncConfig });
  return { storage, syncConfig };
};

describe("RePureTableBar 表格偏好持久化", () => {
  beforeEach(() => {
    hoisted.store.clear();
    hoisted.setSiteConfig.mockClear();
  });

  it("写本地：按页面键合并进偏好表并同步 siteConfig（主题保存不会回滚）", () => {
    const { storage, syncConfig } = makeStorage();
    expect(storage.readLocalMap()).toEqual({});

    storage.writeLocal("system/user", { size: "small", hidden: ["备注"] });
    storage.writeLocal("system/role", { order: ["名称", "编码"] });

    expect(storage.readLocalMap()).toEqual({
      "system/user": { size: "small", hidden: ["备注"] },
      "system/role": { order: ["名称", "编码"] }
    });
    expect(syncConfig).toHaveBeenCalledTimes(2);
    expect(syncConfig.mock.calls[1][0]).toEqual(storage.readLocalMap());
  });

  it("远端同步：整包 TablePrefs 单键下发", () => {
    const { storage } = makeStorage();
    storage.writeLocal("system/user", { size: "large" });
    storage.patchRemote();
    expect(hoisted.setSiteConfig).toHaveBeenCalledWith({
      TablePrefs: { "system/user": { size: "large" } }
    });
  });
});

describe("RePureTableBar 列显隐 / 列序应用", () => {
  it("hidden 按 label 打标；无 label 的列静默忽略", () => {
    const columns: TableColumnLike[] = [
      { label: "名称" },
      { label: "状态" },
      { label: "备注" },
      {}
    ];
    const result = applyTablePrefs(
      { hidden: ["状态"], size: "small" },
      columns
    );
    expect(columns.map(column => column.hide)).toEqual([
      false,
      true,
      false,
      undefined
    ]);
    expect(result.size).toBe("small");
  });

  it("order 按 label 排序，未登记的列保持默认序并排在末尾", () => {
    const columns: TableColumnLike[] = [
      { label: "名称" },
      { label: "状态" },
      { label: "备注" },
      { label: "操作" }
    ];
    applyTablePrefs({ order: ["备注", "名称"] }, columns);
    expect(columns.map(column => column.label)).toEqual([
      "备注",
      "名称",
      "状态",
      "操作"
    ]);
  });

  it("无列或无偏好时零变化（不写入任何 hide）", () => {
    const columns: TableColumnLike[] = [{ label: "名称" }];
    const result = applyTablePrefs({ order: ["名称"] }, columns);
    expect(columns[0].hide).toBeUndefined();
    expect(result.size).toBeUndefined();
    expect(applyTablePrefs({ hidden: ["x"] }, [])).toEqual({});
  });
});

describe("RePureTableBar 工具函数", () => {
  it("全屏类名切换：铺满 + 提层 + 去掉上边距", () => {
    const normal = buildRenderClass(false);
    expect(normal).toContain("mt-2");
    const fullscreen = buildRenderClass(true);
    expect(fullscreen).not.toContain("mt-2");
    expect(fullscreen.join(" ")).toContain("re-plus-table-card--fullscreen");
    expect(fullscreen.join(" ")).toContain("fixed");
  });

  it("列固定状态归一：true/right 归右固定，left 归左固定", () => {
    expect(resolveFixedState({ fixed: true })).toEqual({
      fixed: true,
      left: false,
      right: true
    });
    expect(resolveFixedState({ fixed: "right" })).toEqual({
      fixed: true,
      left: false,
      right: true
    });
    expect(resolveFixedState({ fixed: "left" })).toEqual({
      fixed: true,
      left: true,
      right: false
    });
    expect(resolveFixedState({})).toEqual({
      fixed: false,
      left: false,
      right: false
    });
    expect(resolveFixedState(undefined)).toEqual({
      fixed: false,
      left: false,
      right: false
    });
  });

  it("树形行递归展开 / 折叠（含嵌套子级）", () => {
    const calls: Array<[string, boolean]> = [];
    const tableRef: ExpandableTableInstance = {
      toggleRowExpansion: (row: TableRowLike, expanded?: boolean) => {
        calls.push([String(row.id), expanded ?? true]);
      }
    };
    toggleRowExpansionAll(
      tableRef,
      [
        { id: "a", children: [{ id: "a-1", children: [] }, { id: "a-2" }] },
        { id: "b" }
      ],
      true
    );
    expect(calls).toEqual([
      ["a", true],
      ["a-1", true],
      ["a-2", true],
      ["b", true]
    ]);
  });

  it("tippy 参数：跟随指针 + 点击切换", () => {
    const props = rendTippyProps("提示");
    expect(props.content).toBe("提示");
    expect(props.followCursor).toBe(true);
    expect(props.hideOnClick).toBe("toggle");
  });
});
