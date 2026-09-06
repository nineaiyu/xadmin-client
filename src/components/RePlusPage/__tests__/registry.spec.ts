import { describe, expect, it, vi } from "vitest";

// UploadFiles.vue 引用 @/router/utils 的 hasAuth，在 vitest SSR 链路会触发
// router 循环导入崩溃；注册表测试只关心渲染器映射，隔离该叶子组件
vi.mock("../src/components/UploadFiles.vue", () => ({ default: {} }));

import {
  getDetailRenderer,
  getFormRenderer,
  getSearchRenderer,
  registerDetailRenderer,
  registerFormRenderer,
  registerSearchRenderer
} from "../src/utils/registry";
import type {
  PageColumn,
  PlusColumnContext,
  PlusColumnHandler
} from "../src/utils/types";

const makeCtx = (inputType: string): PlusColumnContext => ({
  column: { input_type: inputType } as PlusColumnContext["column"],
  t: key => key,
  te: () => false,
  localeName: "zh",
  apiSearchComponents: {}
});

const makeColumn = (inputType: string): PageColumn =>
  ({ _column: { input_type: inputType } }) as unknown as PageColumn;

const taggingHandler: PlusColumnHandler = (item, ctx) => {
  (item as { tagged?: boolean }).tagged = true;
  (item as { from?: string }).from = ctx.column.input_type as string;
};

describe("RePlusPage 列渲染器注册表", () => {
  it("内置渲染器：text 搜索列映射为 input", () => {
    const item = makeColumn("text");
    getSearchRenderer("text")(item, makeCtx("text"));
    expect(item.valueType).toBe("input");
  });

  it("未注册的 input_type 搜索/表单回退到 default 行为且不抛错", () => {
    const item = makeColumn("never-exists");
    expect(() =>
      getSearchRenderer("never-exists")(item, makeCtx("never-exists"))
    ).not.toThrow();
    expect(() =>
      getFormRenderer("never-exists")(item, makeCtx("never-exists"))
    ).not.toThrow();
  });

  it("未注册的 input_type 详情渲染器返回 undefined（与内置行为一致）", () => {
    expect(getDetailRenderer("never-exists")).toBeUndefined();
  });

  it("registerSearchRenderer 注册自定义类型并可覆盖", () => {
    registerSearchRenderer("custom-search", taggingHandler);
    const item = makeColumn("custom-search");
    getSearchRenderer("custom-search")(item, makeCtx("custom-search"));
    expect(item.tagged).toBe(true);
    expect(item.from).toBe("custom-search");

    // 覆盖注册：后注册的处理器生效
    registerSearchRenderer("custom-search", current => {
      (current as { overridden?: boolean }).overridden = true;
    });
    const item2 = makeColumn("custom-search");
    getSearchRenderer("custom-search")(item2, makeCtx("custom-search"));
    expect(item2.overridden).toBe(true);
    expect(item2.tagged).toBeUndefined();
  });

  it("registerFormRenderer 注册表单渲染器", () => {
    registerFormRenderer("custom-form", taggingHandler);
    const item = makeColumn("custom-form");
    getFormRenderer("custom-form")(item, makeCtx("custom-form"));
    expect(item.tagged).toBe(true);
  });

  it("registerDetailRenderer 注册详情渲染器", () => {
    registerDetailRenderer("custom-detail", taggingHandler);
    const item = makeColumn("custom-detail");
    getDetailRenderer("custom-detail")?.(item, makeCtx("custom-detail"));
    expect(item.tagged).toBe(true);
  });

  it("注册新类型不影响其它内置类型", () => {
    registerSearchRenderer("another-one", taggingHandler);
    const textItem = makeColumn("text");
    getSearchRenderer("text")(textItem, makeCtx("text"));
    expect(textItem.valueType).toBe("input");
  });
});
