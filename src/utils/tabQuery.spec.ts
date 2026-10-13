import { describe, expect, it, vi, afterEach } from "vitest";
import { buildTabHash, resolveInitialPane, syncTabQuery } from "./tabQuery";

describe("buildTabHash", () => {
  it("写入 tab 参数（hash 路由形态）", () => {
    expect(buildTabHash("#/account-settings", "securityLog")).toBe(
      "#/account-settings?tab=securityLog"
    );
  });

  it("保留其余 query 参数", () => {
    expect(buildTabHash("#/account-settings?from=notice", "mfa")).toBe(
      "#/account-settings?from=notice&tab=mfa"
    );
  });

  it("覆盖既有 tab（切换页签不累积）", () => {
    expect(buildTabHash("#/account-settings?tab=profile", "mfa")).toBe(
      "#/account-settings?tab=mfa"
    );
  });

  it("兼容不带 # 前缀的输入", () => {
    expect(buildTabHash("/account-settings", "profile")).toBe(
      "#/account-settings?tab=profile"
    );
  });
});

describe("resolveInitialPane", () => {
  const panes = [
    { key: "profile", auth: true },
    { key: "securityLog", auth: true },
    { key: "Notifications", auth: false }
  ];

  it("命中可用页签时直达（OAuth 回调 / 刷新保持）", () => {
    expect(resolveInitialPane(panes, "securityLog", "profile")).toBe(
      "securityLog"
    );
  });

  it("无权限页签回落首个页签", () => {
    expect(resolveInitialPane(panes, "Notifications", "profile")).toBe(
      "profile"
    );
  });

  it("非法 key 与空值均回落", () => {
    expect(resolveInitialPane(panes, "not-a-pane", "profile")).toBe("profile");
    expect(resolveInitialPane(panes, undefined, "profile")).toBe("profile");
    expect(resolveInitialPane(panes, null, "profile")).toBe("profile");
    expect(resolveInitialPane(panes, "", "profile")).toBe("profile");
  });
});

describe("syncTabQuery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.location.hash = "";
  });

  it("经 history.replaceState 写入地址栏（不触发路由导航）", () => {
    window.location.hash = "#/account-settings";
    const spy = vi.spyOn(window.history, "replaceState");

    syncTabQuery("securityLog");

    expect(spy).toHaveBeenCalledWith(
      null,
      "",
      "#/account-settings?tab=securityLog"
    );
  });

  it("空 key 不写入（防误清空）", () => {
    window.location.hash = "#/account-settings";
    const spy = vi.spyOn(window.history, "replaceState");

    syncTabQuery("");

    expect(spy).not.toHaveBeenCalled();
  });
});
