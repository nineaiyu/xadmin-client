import { createRouter, createWebHashHistory } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { goBackOrHome, hasInAppHistory } from "./history";

/**
 * 回退优先辅助（hasInAppHistory / goBackOrHome）单测：
 * 判定依据是 vue-router 写入 history.state 的 back 字段——SPA 内导航过才有值，
 * 直达进入（刷新/新标签/外链落地）恒为空，此时 go(-1) 是无操作、应回首页。
 * back 由 Web history 实现在 pushState 时写入（memory history 不写），故用真实
 * hash history 驱动，不手搓 state 桩。
 */
const buildRouter = () =>
  createRouter({
    history: createWebHashHistory(""),
    routes: [
      { path: "/", component: { render: () => null } },
      { path: "/:pathMatch(.*)*", component: { render: () => null } }
    ]
  });

describe("router history 回退辅助", () => {
  let router: ReturnType<typeof buildRouter>;
  beforeEach(() => {
    // 清掉上一例留下的会话状态：history.state 里残留的 back 会被新路由继承
    window.history.replaceState(null, "", "/");
    router = buildRouter();
  });

  it("直达进入（无任何 SPA 导航）：hasInAppHistory 为 false", () => {
    expect(hasInAppHistory(router)).toBe(false);
  });

  it("SPA 内导航过：hasInAppHistory 为 true", async () => {
    await router.push("/");
    await router.push("/somewhere");
    expect(hasInAppHistory(router)).toBe(true);
  });

  it("有站内上一页：goBackOrHome 走 go(-1)，不回首页", async () => {
    await router.push("/");
    await router.push("/somewhere");
    const go = vi.spyOn(router, "go").mockImplementation(vi.fn());
    const push = vi.spyOn(router, "push").mockResolvedValue(undefined);
    goBackOrHome(router);
    expect(go).toHaveBeenCalledWith(-1);
    expect(push).not.toHaveBeenCalled();
  });

  it("直达场景：goBackOrHome 回首页，不执行无效的 go(-1)", () => {
    const go = vi.spyOn(router, "go").mockImplementation(vi.fn());
    const push = vi.spyOn(router, "push").mockResolvedValue(undefined);
    goBackOrHome(router);
    expect(push).toHaveBeenCalledWith("/");
    expect(go).not.toHaveBeenCalled();
  });
});
