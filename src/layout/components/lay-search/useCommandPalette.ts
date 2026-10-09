import { computed, onBeforeUnmount } from "vue";
import { onKeyStroke } from "@vueuse/core";
import { hasAuth } from "@/router/utils";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";
import { QUICK_ACTIONS } from "./commandPaletteRegistry";
import { createNavController } from "./commandPaletteNav";
import type { CommandPaletteOptions } from "./commandPaletteTypes";

export type { CommandPaletteOptions } from "./commandPaletteTypes";

/**
 * 命令面板：Cmd/Ctrl+K 唤起 + 快捷动作 + 键盘全导航。
 *
 * 与顶栏搜索合流（不新建重复组件）：无关键字时「快捷动作」参与 ↑↓/Enter，
 * 有候选时菜单结果与全局搜索分组按同一导航指针串联，鼠标点击仍走原有高亮逻辑。
 *
 * 动作注册表见 commandPaletteRegistry.ts，键盘导航见 commandPaletteNav.ts。
 */
export function useCommandPalette(options: CommandPaletteOptions) {
  const {
    t,
    router,
    show,
    keyword,
    resultOptions,
    historyOptions,
    globalGroups,
    activePath,
    historyPath,
    scrollTo,
    goGlobalResult,
    saveHistory,
    updateHistory,
    handleClose
  } = options;

  const commandItems = computed(() =>
    QUICK_ACTIONS.filter(action => !action.auth || hasAuth(action.auth)).map(
      action => ({
        id: action.id,
        title: t(action.titleKey),
        icon: action.icon,
        route: action.route
      })
    )
  );

  /** 执行快捷动作：路由类跳转，主题类就地切换 */
  const runQuickAction = (id: string) => {
    const action = commandItems.value.find(item => item.id === id);
    if (!action) return;
    if (action.id === "cmd:theme") {
      const { dataTheme, dataThemeChange } = useDataThemeChange();
      dataTheme.value = !dataTheme.value;
      dataThemeChange();
      handleClose();
      return;
    }
    if (action.route) {
      router.push(action.route);
      handleClose();
    }
  };

  const nav = createNavController({
    router,
    commandItems,
    keyword,
    resultOptions,
    historyOptions,
    globalGroups,
    activePath,
    historyPath,
    scrollTo,
    goGlobalResult,
    saveHistory,
    updateHistory,
    handleClose,
    runQuickAction
  });

  // 键盘绑定：Esc 由弹窗自身处理
  const stopEnter = onKeyStroke("Enter", nav.handleEnter);
  const stopUp = onKeyStroke("ArrowUp", nav.handleUp);
  const stopDown = onKeyStroke("ArrowDown", nav.handleDown);
  const stopCmdK = onKeyStroke("k", event => {
    if (!(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    nav.activeNav.value = "";
    show.value = true;
  });

  onBeforeUnmount(() => {
    stopEnter();
    stopUp();
    stopDown();
    stopCmdK();
  });

  return {
    commandItems,
    commandActive: nav.commandActive,
    globalActive: nav.globalActive,
    activeNav: nav.activeNav,
    handleEnter: nav.handleEnter,
    handleUp: nav.handleUp,
    handleDown: nav.handleDown,
    runQuickAction
  };
}
