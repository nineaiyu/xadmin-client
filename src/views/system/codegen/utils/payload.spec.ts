import { describe, expect, it } from "vitest";
import type { CodegenFieldOverride } from "@/api/system/codegen";
import {
  buildBatchPayload,
  buildPayload,
  defaultFormState,
  normalizeFormState,
  type CodegenFormState
} from "./payload";

function fullState(
  overrides: Partial<CodegenFormState> = {}
): CodegenFormState {
  return {
    ...defaultFormState(),
    model: "demo.Book",
    component: "DemoBook",
    url_prefix: "api/demo/book",
    frontend_dir: "demo/book",
    menu_parent: "p-1",
    menu_icon: "ep:grid",
    with_import_export: true,
    with_module: true,
    module_id: "demo",
    fields: [{ name: "name", label: "书名" }] as CodegenFieldOverride[],
    ...overrides
  };
}

describe("buildPayload", () => {
  it("空串收敛为 undefined（后端按缺省推导）", () => {
    const payload = buildPayload(defaultFormState());
    expect(payload.model).toBe("");
    expect(payload.component).toBeUndefined();
    expect(payload.url_prefix).toBeUndefined();
    expect(payload.menu_parent).toBeUndefined();
    expect(payload.menu_icon).toBeUndefined();
    expect(payload.fields).toBeUndefined();
  });

  it("携带字段覆盖与命名参数", () => {
    const payload = buildPayload(fullState());
    expect(payload.component).toBe("DemoBook");
    expect(payload.menu_parent).toBe("p-1");
    expect(payload.menu_icon).toBe("ep:grid");
    expect(payload.fields).toHaveLength(1);
  });

  it("module_id 仅在 with_module 开启时携带", () => {
    expect(buildPayload(fullState()).module_id).toBe("demo");
    expect(
      buildPayload(fullState({ with_module: false })).module_id
    ).toBeUndefined();
  });

  it("skip 语义开关：AI 声明 / 前端产物默认开启", () => {
    expect(buildPayload(defaultFormState()).skip_ai).toBe(false);
    expect(buildPayload(defaultFormState()).skip_frontend).toBe(false);
    const trimmed = buildPayload(
      fullState({ with_ai: false, with_frontend: false })
    );
    expect(trimmed.skip_ai).toBe(true);
    expect(trimmed.skip_frontend).toBe(true);
  });

  it("菜单标题与列表排序非空才携带", () => {
    expect(buildPayload(defaultFormState()).menu_title).toBeUndefined();
    expect(buildPayload(defaultFormState()).ordering).toBeUndefined();
    const filled = buildPayload(
      fullState({ menu_title: "书籍管理", ordering: "-created_time" })
    );
    expect(filled.menu_title).toBe("书籍管理");
    expect(filled.ordering).toBe("-created_time");
  });
});

describe("buildBatchPayload", () => {
  it("多模型共享开关且忽略字段级覆盖", () => {
    const payload = buildBatchPayload(
      ["demo.Book", "system.DataDict"],
      fullState()
    );
    expect(payload.models).toEqual(["demo.Book", "system.DataDict"]);
    expect(payload.with_import_export).toBe(true);
    expect(payload.fields).toBeUndefined();
    expect(payload.model).toBeUndefined();
  });
});

describe("normalizeFormState", () => {
  it("补齐缺失键并过滤非法字段项（旧方案向后兼容）", () => {
    const state = normalizeFormState({
      model: "demo.Book",
      fields: [{ name: "name" }, null, { label: "无name" }, "oops"]
    });
    expect(state.with_tests).toBe(false);
    expect(state.module_level).toBe("optional");
    expect(state.fields).toEqual([{ name: "name" }]);
  });

  it("非法输入回退全默认", () => {
    expect(normalizeFormState(null)).toEqual(defaultFormState());
    expect(normalizeFormState("nope")).toEqual(defaultFormState());
  });

  it("旧方案补齐新增开关默认值（with_ai/with_frontend = true）", () => {
    const state = normalizeFormState({ model: "demo.Book" });
    expect(state.with_ai).toBe(true);
    expect(state.with_frontend).toBe(true);
    expect(state.ordering).toBe("");
  });

  it("非法 module_level 回退默认", () => {
    expect(normalizeFormState({ module_level: "bogus" }).module_level).toBe(
      "optional"
    );
  });
});
