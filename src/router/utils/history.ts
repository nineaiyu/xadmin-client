import type { Router } from "vue-router";

/**
 * 站内是否还有上一页可退：vue-router 在 SPA 内每次导航都会把上一条路由写进
 * history.state 的 back 字段；直达进入（刷新/新标签/外部链接落地）时 back 恒为
 * null。不能用 history.length 判断——地址栏直达时浏览器会话长度也可能大于 1。
 */
export function hasInAppHistory(router: Router): boolean {
  return router.options.history.state.back != null;
}

/** 回退优先：有站内上一页则 go(-1)，否则回首页（直达场景 go(-1) 是无操作） */
export function goBackOrHome(router: Router): void {
  if (hasInAppHistory(router)) {
    router.go(-1);
  } else {
    void router.push("/");
  }
}
