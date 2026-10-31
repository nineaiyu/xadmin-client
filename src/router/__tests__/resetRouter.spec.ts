import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { resetRouter, router } from "@/router";
import type { RouteRecordRaw } from "vue-router";

describe("resetRouter", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("清除动态子路由并把 options.routes 恢复为静态快照", () => {
    const dynamic: RouteRecordRaw = {
      path: "/old-account/page",
      name: "OldAccountPage",
      component: { render: () => null }
    };
    const rootChildren = router.options.routes[0].children as RouteRecordRaw[];
    rootChildren.push(dynamic);
    router.addRoute(dynamic);
    expect(router.hasRoute("OldAccountPage")).toBe(true);

    resetRouter();

    expect(router.hasRoute("OldAccountPage")).toBe(false);
    const paths = (router.options.routes[0].children ?? []).map(
      child => child.path
    );
    expect(paths).not.toContain("/old-account/page");
  });
});
