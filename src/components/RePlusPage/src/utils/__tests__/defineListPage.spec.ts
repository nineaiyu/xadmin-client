import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isReactive, isRef, reactive } from "vue";

const { usePageAuthMock, hasAuthMock, authCodesLoadedMock } = vi.hoisted(
  () => ({
    usePageAuthMock: vi.fn(),
    hasAuthMock: vi.fn(),
    authCodesLoadedMock: vi.fn()
  })
);

// DEFAULT_AUTH_ACTIONS 用测试专用的最小清单：组件契约只依赖「默认按钮位清单」
// 本身，真实清单的演进由 auth.ts 侧测试与类型共同约束，此处不复制第二份。
vi.mock("@/router/utils", () => ({
  usePageAuth: usePageAuthMock,
  hasAuth: hasAuthMock,
  authCodesLoaded: authCodesLoadedMock,
  DEFAULT_AUTH_ACTIONS: ["list", "create"]
}));
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
  let consoleError: ReturnType<typeof vi.spyOn>;
  let consoleWarn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // 开发态守护在 vitest（DEV=true）下会直接输出，静默并侦听供用例断言
    const silence = () => undefined;
    consoleError = vi.spyOn(console, "error").mockImplementation(silence);
    consoleWarn = vi.spyOn(console, "warn").mockImplementation(silence);
    // 默认「权限码字典未装载」：既有装配用例不触发缺码告警
    authCodesLoadedMock.mockReturnValue(false);
    hasAuthMock.mockReturnValue(false);
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

  afterEach(() => {
    consoleError.mockRestore();
    consoleWarn.mockRestore();
    vi.unstubAllEnvs();
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

  describe("开发态权限守护（authSuffix 必填校验 + 缺码告警）", () => {
    it("后缀无法解析（无组件实例且未显式指定）时报错并说明修复方式", () => {
      // 直接函数调用：getCurrentInstance() 为空，模拟组件未声明 name / 脱离 setup 调用
      defineListPage({ api: {}, localeName: "post" });

      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError.mock.calls[0]![0]).toContain("authSuffix");
      // 后缀缺失时不再叠加缺码告警（无从判定）
      expect(consoleWarn).not.toHaveBeenCalled();
    });

    it("权限码全部未命中时告警，并带上后缀与对齐建议", () => {
      authCodesLoadedMock.mockReturnValue(true);
      hasAuthMock.mockReturnValue(false);

      defineListPage({ api: {}, localeName: "tag", authSuffix: "Tag" });

      expect(consoleWarn).toHaveBeenCalledTimes(1);
      const message = String(consoleWarn.mock.calls[0]![0]);
      expect(message).toContain("*:Tag");
      expect(message).toContain("authSuffix");
      expect(consoleError).not.toHaveBeenCalled();
    });

    it("任一默认按钮位命中即不告警", () => {
      authCodesLoadedMock.mockReturnValue(true);
      hasAuthMock.mockImplementation((code: string) => code === "list:Tag");

      defineListPage({ api: {}, localeName: "tag", authSuffix: "Tag" });

      expect(consoleWarn).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    });

    it("权限码字典未装载（守卫未完成/测试桩）时跳过缺码判定", () => {
      authCodesLoadedMock.mockReturnValue(false);

      defineListPage({ api: {}, localeName: "tag", authSuffix: "Tag" });

      expect(consoleWarn).not.toHaveBeenCalled();
    });

    it("生产构建（import.meta.env.DEV=false）零输出", () => {
      vi.stubEnv("DEV", false);
      authCodesLoadedMock.mockReturnValue(true);

      defineListPage({ api: {}, localeName: "post" });

      expect(consoleError).not.toHaveBeenCalled();
      expect(consoleWarn).not.toHaveBeenCalled();
    });
  });
});
