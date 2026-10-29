import { computed, onBeforeUnmount, watch } from "vue";
import { onKeyStroke } from "@vueuse/core";
import { hasAuth } from "@/router/utils";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";
import { QUICK_ACTIONS } from "./commandPaletteRegistry";
import { createNavController } from "./commandPaletteNav";
import { isPaletteShortcut } from "./commandPaletteShortcut";
import { resetActiveWhenClosed, whenPaletteOpen } from "./paletteGuard";
import type { CommandPaletteOptions } from "./commandPaletteTypes";

export type { CommandPaletteOptions } from "./commandPaletteTypes";

/**
 * 命令面板：Cmd/Ctrl+K 唤起 + 快捷动作 + 键盘全导航（与顶栏搜索合流）。
 * 无关键字时「快捷动作」参与 ↑↓/Enter；有候选时菜单结果与全局搜索分组按同一
 * 导航指针串联。注册表见 commandPaletteRegistry.ts，导航见 commandPaletteNav.ts。
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
    askAiVisible,
    scrollTo,
    goGlobalResult,
    runAskAi,
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
    askAiVisible,
    scrollTo,
    goGlobalResult,
    runAskAi,
    saveHistory,
    updateHistory,
    handleClose,
    runQuickAction
  });

  // 关闭即清激活项（复开不残留）；Enter/↑↓ 全局监听必须判面板
  // 可见，否则关闭后任意输入框按 Enter 会执行上次激活项（意外跳路由/切主题）。
  // 守卫本身是纯函数（paletteGuard.ts），单测直测不依赖挂载。
  watch(show, resetActiveWhenClosed(nav.activeNav));
  const whenOpen = (handler: () => void) => whenPaletteOpen(show, handler);
  const stops = [
    onKeyStroke("Enter", whenOpen(nav.handleEnter)),
    onKeyStroke("ArrowUp", whenOpen(nav.handleUp)),
    onKeyStroke("ArrowDown", whenOpen(nav.handleDown)),
    // 快捷键总开关 / 全局搜索键位关闭后仍可从顶栏入口打开面板
    onKeyStroke(
      (event: KeyboardEvent) => isPaletteShortcut(event),
      (event: KeyboardEvent) => {
        event.preventDefault();
        nav.activeNav.value = "";
        show.value = true;
      },
      { eventName: "keydown" }
    )
  ];
  onBeforeUnmount(() => stops.forEach(stop => stop()));

  return {
    commandItems,
    commandActive: nav.commandActive,
    globalActive: nav.globalActive,
    askAiActive: nav.askAiActive,
    activeNav: nav.activeNav,
    handleEnter: nav.handleEnter,
    handleUp: nav.handleUp,
    handleDown: nav.handleDown,
    runQuickAction
  };
}
