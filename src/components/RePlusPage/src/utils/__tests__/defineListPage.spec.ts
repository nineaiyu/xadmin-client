import { beforeEach, describe, expect, it, vi } from "vitest";
import { isReactive, isRef, reactive } from "vue";

const { usePageAuthMock } = vi.hoisted(() => ({
  usePageAuthMock: vi.fn()
}));

vi.mock("@/router/utils", () => ({ usePageAuth: usePageAuthMock }));
vi.mock("vue-i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: { value: "zh-CN" }
  })
}));

import { defineListPage } from "../defineListPage";
import type { PageTableColumn } from "../types";

const column = (key: string) => ({ _column: { key } }) as PageTableColumn;

/** 回调上下文探测：只声明断言用到的字段，完整上下文可结构化赋值 */
type CtxProbe = {
  api: unknown;
  auth: unknown;
  tableRef: unknown;
  localeName: string;
  t: (key: string) => string;
  locale: { readonly value: string };
};
type ColumnsCtxProbe = CtxProbe & { columns: PageTableColumn[] };

describe("defineListPage", () => {
  beforeEach(() => {
    usePageAuthMock.mockImplementation(
      (nameOrKeys?: string | string[], extraKeys: string[] = []) => {
        const keys =
          typeof nameOrKeys === "string" ? extraKeys : (nameOrKeys ?? []);
        return reactive({
          list: true,
          ...Object.fromEntries(keys.map(key => [key, true]))
        });
      }
    );
  });

  it("最小配置只返回 api / auth / tableRef / t，api 为 reactive 包装", () => {
    const raw = { list: vi.fn() };
    const page = defineListPage({ api: raw, localeName: "post" });

    expect(Object.keys(page).sort()).toEqual(["api", "auth", "t", "tableRef"]);
    expect(isReactive(page.api)).toBe(true);
    expect(isRef(page.tableRef)).toBe(true);
    // 权限后缀由当前组件实例推导，工厂不接收组件名参数
    expect(usePageAuthMock).toHaveBeenCalledWith([]);
  });

  it("authSuffix 显式指定权限码后缀（历史命名页面）", () => {
    const page = defineListPage({
      api: {},
      localeName: "tag",
      authSuffix: "Tag",
      extraAuth: ["assign"]
    });

    expect(usePageAuthMock).toHaveBeenCalledWith("Tag", ["assign"]);
    expect(page.auth.assign).toBe(true);
  });

  it("extraAuth 以数组形式传给 usePageAuth，并并入返回的 auth", () => {
    const page = defineListPage({
      api: {},
      localeName: "systemOnline",
      extraAuth: ["forceLogout", "batchForceLogout"]
    });

    expect(usePageAuthMock).toHaveBeenCalledWith([
      "forceLogout",
      "batchForceLogout"
    ]);
    expect(usePageAuthMock.mock.calls[0]).toHaveLength(1);
    expect(page.auth).toBe(usePageAuthMock.mock.results[0].value);
    expect(page.auth.forceLogout).toBe(true);
  });

  it("columns 回调拿到完整上下文，返回 undefined 时回退入参列", () => {
    const columns = [column("name")];
    const columnsSpy = vi.fn((_ctx: ColumnsCtxProbe) => undefined);
    const page = defineListPage({
      api: {},
      localeName: "post",
      columns: columnsSpy
    });

    const result = page.listColumnsFormat!(columns);
    const ctx = columnsSpy.mock.calls[0]![0];

    expect(ctx.api).toBe(page.api);
    expect(ctx.auth).toBe(page.auth);
    expect(ctx.tableRef).toBe(page.tableRef);
    expect(ctx.localeName).toBe("post");
    expect(ctx.t("post.enabled")).toBe("post.enabled");
    expect(ctx.locale.value).toBe("zh-CN");
    expect(ctx.columns).toBe(columns);
    expect(result).toBe(columns);
  });

  it("columns 回调返回新数组时透传其结果", () => {
    const formatted = [column("name")];
    const page = defineListPage({
      api: {},
      localeName: "post",
      columns: () => formatted
    });

    expect(page.listColumnsFormat!([column("name")])).toBe(formatted);
  });

  it("formOptions 与 buttons 共用同一上下文，未返回的可选键不出现", () => {
    const formSpy = vi.fn((_ctx: CtxProbe) => ({ props: { columns: {} } }));
    const buttonsSpy = vi.fn((_ctx: CtxProbe) => ({
      tableBarButtonsProps: { buttons: [] }
    }));
    const page = defineListPage({
      api: {},
      localeName: "book",
      formOptions: formSpy,
      buttons: buttonsSpy
    });

    const formCtx = formSpy.mock.calls[0]![0];
    const buttonsCtx = buttonsSpy.mock.calls[0]![0];

    expect(formCtx.api).toBe(page.api);
    expect(formCtx.auth).toBe(page.auth);
    expect(formCtx.tableRef).toBe(page.tableRef);
    expect(buttonsCtx).toBe(formCtx);
    expect(page.addOrEditOptions).toEqual({ props: { columns: {} } });
    expect(page.tableBarButtonsProps).toEqual({ buttons: [] });
    expect(page).not.toHaveProperty("operationButtonsProps");
  });

  it("buttons 只返回 operationButtonsProps 时键集合按需收窄", () => {
    const operationButtonsProps = { width: 180, buttons: [] };
    const page = defineListPage({
      api: {},
      localeName: "mask",
      extraAuth: ["preview"],
      buttons: () => ({ operationButtonsProps })
    });

    expect(page.operationButtonsProps).toBe(operationButtonsProps);
    expect(page).not.toHaveProperty("tableBarButtonsProps");
    expect(page).not.toHaveProperty("addOrEditOptions");
    expect(page).not.toHaveProperty("listColumnsFormat");
  });
});
