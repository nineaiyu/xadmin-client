import { describe, expect, beforeEach, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";

import { useLoginPageStore } from "../loginPage";

describe("loginPage store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("store id 保持 pure-login-page", () => {
    expect(useLoginPageStore().$id).toBe("pure-login-page");
  });

  it("登录页 UI 态初值", () => {
    const store = useLoginPageStore();
    expect(store.currentPage).toBe(0);
    expect(store.isRemembered).toBe(false);
    expect(store.loginDay).toBe(7);
    expect(store.verifyCodeLength).toBe(0);
  });

  it("页面状态", () => {
    const store = useLoginPageStore();
    store.SET_VERIFY_CODE_LENGTH(6);
    store.SET_CURRENT_PAGE(3);
    store.SET_ISREMEMBERED(true);
    store.SET_LOGINDAY(14);
    expect(store.verifyCodeLength).toBe(6);
    expect(store.currentPage).toBe(3);
    expect(store.isRemembered).toBe(true);
    expect(store.loginDay).toBe(14);
  });
});
