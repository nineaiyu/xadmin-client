import { computed, onBeforeUnmount, watch } from "vue";
import { hasAuth } from "@/router/utils";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";
import { QUICK_ACTIONS } from "./commandPaletteRegistry";
import { createNavController } from "./commandPaletteNav";
import { registerPaletteKeys } from "./commandPaletteKeys";
import { resetActiveWhenClosed } from "./paletteGuard";
import type { CommandPaletteOptions } from "./commandPaletteTypes";

export type { CommandPaletteOptions } from "./commandPaletteTypes";

/**
 * 命令面板：Cmd/Ctrl+K 唤起/关闭（toggle）+ 快捷动作 + 键盘全导航（与顶栏搜索合流）。
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
  // 全局按键注册（Enter/↑↓ + Cmd/Ctrl+K toggle）抽出为 commandPaletteKeys，
  // 本文件不超 hook 行数门禁
  const stops = registerPaletteKeys({
    show,
    activeNav: nav.activeNav,
    handleEnter: nav.handleEnter,
    handleUp: nav.handleUp,
    handleDown: nav.handleDown,
    handleClose
  });
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
