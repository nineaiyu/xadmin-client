import { describe, expect, beforeEach, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";

import { useLoginPageStore } from "../loginPage";
import type { AuthCapabilitiesResult } from "@/api/auth";

const CAPABILITIES: AuthCapabilitiesResult["data"] = {
  access: true,
  lifetime: 7,
  basic: {
    enabled: true,
    captcha: false,
    captcha_types: [],
    captcha_image_fallback: false,
    token: false,
    encrypted: false
  },
  code: { enabled: true, email: true, sms: false },
  register: { enabled: true, email: true, sms: false },
  reset: { enabled: true, email: true, sms: false },
  oauth: []
};

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
    expect(store.capabilities).toBeNull();
    expect(store.capabilitiesStatus).toBe("loading");
  });

  it("页面状态", () => {
    const store = useLoginPageStore();
    store.SET_CURRENT_PAGE(3);
    store.SET_ISREMEMBERED(true);
    store.SET_LOGINDAY(14);
    expect(store.currentPage).toBe(3);
    expect(store.isRemembered).toBe(true);
    expect(store.loginDay).toBe(14);
  });

  it("能力清单:写入即 success,状态可独立更新(失败/重试由外壳驱动)", () => {
    const store = useLoginPageStore();
    store.SET_CAPABILITIES_STATUS("failed");
    expect(store.capabilitiesStatus).toBe("failed");

    store.SET_CAPABILITIES(CAPABILITIES);
    expect(store.capabilities).toEqual(CAPABILITIES);
    expect(store.capabilitiesStatus).toBe("success");
  });
});
