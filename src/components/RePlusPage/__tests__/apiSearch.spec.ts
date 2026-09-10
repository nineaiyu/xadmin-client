import { describe, expect, it } from "vitest";
import {
  getApiSearchComponent,
  getApiSearchComponents,
  registerApiSearchComponent,
  registerApiSearchComponents
} from "../src/utils/apiSearch";

/** 仅用于标识的假组件（注册表只做映射，不关心组件实现） */
const fakeComponent = (name: string) => ({ name }) as never;

describe("RePlusPage api-search 组件注册表", () => {
  it("注册后可按名取用", () => {
    const Fake = fakeComponent("FakeSearch");
    registerApiSearchComponent("api-search-fake", Fake);
    expect(getApiSearchComponent("api-search-fake")).toBe(Fake);
  });

  it("批量注册合并进同一注册表", () => {
    const A = fakeComponent("A");
    const B = fakeComponent("B");
    registerApiSearchComponents({ "api-search-a": A, "api-search-b": B });
    expect(getApiSearchComponents()["api-search-a"]).toBe(A);
    expect(getApiSearchComponents()["api-search-b"]).toBe(B);
  });

  it("未注册的类型返回 undefined 且不抛错（渲染为空节点）", () => {
    expect(getApiSearchComponent("api-search-never-exists")).toBeUndefined();
  });

  it("同名重复注册以后注册的为准", () => {
    const First = fakeComponent("First");
    const Second = fakeComponent("Second");
    registerApiSearchComponent("api-search-dup", First);
    registerApiSearchComponent("api-search-dup", Second);
    expect(getApiSearchComponent("api-search-dup")).toBe(Second);
  });
});
