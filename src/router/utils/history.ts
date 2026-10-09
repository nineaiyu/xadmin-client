import {
  createWebHashHistory,
  createWebHistory,
  type Router,
  type RouterHistory
} from "vue-router";

/**
 * 路由历史模式解析（纯函数，无 store 依赖）。
 *
 * 归置在 history.ts 而非 nav.ts：nav 依赖 store 模块，路由实例创建需要本函数，
 * 若从 nav 引入会让「路由实例 → nav → store → …」成环。
 * 构建配置保证命中合法值，未命中时返回 undefined。
 */
export function getHistoryMode(
  routerHistory: string
): RouterHistory | undefined {
  // len为1 代表只有历史模式 为2 代表历史模式中存在base参数
  const historyMode = routerHistory.split(",");
  const leftMode = historyMode[0];
  const rightMode = historyMode[1];
  // no param
  if (historyMode.length === 1) {
    if (leftMode === "hash") {
      return createWebHashHistory("");
    } else if (leftMode === "h5") {
      return createWebHistory("");
    }
  } //has param
  else if (historyMode.length === 2) {
    if (leftMode === "hash") {
      return createWebHashHistory(rightMode);
    } else if (leftMode === "h5") {
      return createWebHistory(rightMode);
    }
  }
}

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
