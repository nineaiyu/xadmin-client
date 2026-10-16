import { useRouter } from "vue-router";
import { useFullscreen } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import Fullscreen from "~icons/ri/fullscreen-fill";
import ExitFullscreen from "~icons/ri/fullscreen-exit-fill";
import { useNavState } from "./useNavState";
import { createNavActions } from "./navActions";

/**
 * 顶栏装配：状态（布局/用户信息/样式）见 useNavState.ts，
 * 动作（标题/登出/跳转/菜单交互）见 navActions.ts。
 */
export function useNav() {
  const { t } = useI18n();
  const routers = useRouter().options.routes;
  const { isFullscreen, toggle } = useFullscreen();

  const state = useNavState();
  const actions = createNavActions({
    pureApp: state.pureApp,
    wholeMenus: state.wholeMenus
  });

  return {
    t,
    title: state.title,
    device: state.device,
    layout: state.layout,
    routers,
    isFullscreen,
    Fullscreen,
    ExitFullscreen,
    toggle,
    $storage: state.$storage,
    isCollapse: state.isCollapse,
    pureApp: state.pureApp,
    username: state.username,
    userAvatar: state.userAvatar,
    avatarsStyle: state.avatarsStyle,
    tooltipEffect: state.tooltipEffect,
    getDivStyle: state.getDivStyle,
    getDropdownItemStyle: state.getDropdownItemStyle,
    getDropdownItemClass: state.getDropdownItemClass,
    ...actions
  };
}
