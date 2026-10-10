import { getConfig } from "@/config";
import { emitter } from "@/utils/mitt";
import { getTopMenu } from "@/router/utils";
import { transformI18n } from "@/plugins/i18n";
import { readConfigurePreferences } from "@/utils/preferences";
import { remainingPaths, router } from "@/router";
import { useUserStoreHook } from "@/store/modules/user";
import type { menuType, routeMetaType } from "../types";
import type { Ref } from "vue";
import type { useAppStoreHook } from "@/store/modules/app";

const errorInfo =
  "The current routing configuration is incorrect, please check the configuration";

/** 顶栏动作（自 useNav.ts 抽出）：标题、登出、面板/设置跳转、侧栏与菜单交互 */
export function createNavActions({
  pureApp,
  wholeMenus
}: {
  pureApp: ReturnType<typeof useAppStoreHook>;
  wholeMenus: Ref<menuType[]>;
}) {
  /** 动态title（设置面板 →「动态标题」关闭时保持平台标题） */
  function changeTitle(meta: routeMetaType) {
    if (readConfigurePreferences().dynamicTitle === false) return;
    const Title = getConfig().Title;
    if (Title) document.title = `${transformI18n(meta.title)} | ${Title}`;
    else document.title = transformI18n(meta.title);
  }

  /** 退出登录 */
  function logout() {
    useUserStoreHook().logOut();
  }

  function backTopMenu() {
    router.push(getTopMenu()?.path ?? "/");
  }

  function onPanel() {
    emitter.emit("openPanel" as never);
  }

  function toAccountSettings() {
    router.push({ name: "AccountSettings" });
  }

  function toggleSideBar() {
    pureApp.toggleSideBar();
  }

  function handleResize(menuRef: { handleResize: () => void } | null) {
    menuRef?.handleResize();
  }

  function resolvePath(route: menuType) {
    if (!route.children) return console.error(errorInfo);
    const httpReg = /^http(s?):\/\//;
    const routeChildPath = route.children[0]?.path;
    if (httpReg.test(routeChildPath ?? "")) {
      return route.path + "/" + routeChildPath;
    }
    return routeChildPath;
  }

  function menuSelect(indexPath: string) {
    if (wholeMenus.value.length === 0 || isRemaining(indexPath)) return;
    emitter.emit("changLayoutRoute", indexPath);
  }

  /** 判断路径是否参与菜单 */
  function isRemaining(path: string) {
    return remainingPaths.includes(path);
  }

  /** 获取`logo` */
  function getLogo() {
    return new URL("/logo.svg", import.meta.url).href;
  }

  return {
    changeTitle,
    logout,
    backTopMenu,
    onPanel,
    toAccountSettings,
    toggleSideBar,
    handleResize,
    resolvePath,
    menuSelect,
    isRemaining,
    getLogo
  };
}
