import { computed, onBeforeUnmount, ref, watch, type Ref } from "vue";
import type { Router } from "vue-router";
import type { ShallowRef } from "vue";
import { onKeyStroke } from "@vueuse/core";
import { hasAuth } from "@/router/utils";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";
import type { GlobalSearchGroup } from "@/api/system/search";
import type { optionsItem } from "./types";

/**
 * 命令面板（U-2）：Cmd/Ctrl+K 唤起 + 快捷动作 + 键盘全导航。
 *
 * 与顶栏搜索合流（不新建重复组件）：无关键字时「快捷动作」参与 ↑↓/Enter，
 * 有候选时菜单结果与全局搜索分组按同一导航指针串联，鼠标点击仍走原有高亮逻辑。
 *
 * 单独成文件的原因：SearchModal 的模板/历史逻辑已接近行数门禁阈值，导航与
 * 动作注册表是独立关注点（可单测，且后续接入更多动作时不改主组件）。
 */

/** 快捷动作注册表：按权限点过滤（无权限不出现） */
const QUICK_ACTIONS = [
  {
    id: "cmd:ai",
    titleKey: "commandPalette.openAi",
    icon: "ri:robot-2-line",
    auth: "status:AiAssistant",
    route: "/integration/ai/index"
  },
  {
    id: "cmd:task",
    titleKey: "commandPalette.openTaskCenter",
    icon: "ri:list-check-2",
    auth: "list:SystemTaskCenter",
    route: "/system/task/index"
  },
  {
    id: "cmd:tag",
    titleKey: "commandPalette.openTags",
    icon: "ri:price-tag-3-line",
    auth: "list:Tag",
    route: "/system/tag/index"
  },
  {
    id: "cmd:theme",
    titleKey: "commandPalette.toggleTheme",
    icon: "ri:sun-line"
  },
  {
    id: "cmd:home",
    titleKey: "commandPalette.backHome",
    icon: "ri:home-4-line",
    route: "/"
  }
];

type NavTarget = {
  key: string;
  kind: "command" | "result" | "global" | "history";
  payload: unknown;
};

export interface CommandPaletteOptions {
  t: (key: string) => string;
  router: Router;
  show: Ref<boolean>;
  keyword: Ref<string>;
  resultOptions: ShallowRef<optionsItem[]>;
  historyOptions: ShallowRef<optionsItem[]>;
  globalGroups: ShallowRef<GlobalSearchGroup[]>;
  activePath: Ref<string>;
  historyPath: Ref<string>;
  scrollTo: (index: number) => void;
  goGlobalResult: (group: GlobalSearchGroup) => void;
  saveHistory: () => void;
  updateHistory: () => void;
  handleClose: () => void;
}

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

  /** 唯一导航指针：cmd:xx / 菜单路径 / global:<组>:<pk> / 历史路径 */
  const activeNav = ref("");
  const commandActive = ref("");
  const globalActive = ref("");

  const navTargets = (): NavTarget[] => {
    const targets: NavTarget[] = [];
    if (keyword.value) {
      resultOptions.value.forEach(item =>
        targets.push({ key: item.path, kind: "result", payload: item })
      );
      globalGroups.value.forEach(group =>
        group.items.forEach(item =>
          targets.push({
            key: `global:${group.key}:${item.pk}`,
            kind: "global",
            payload: group
          })
        )
      );
    } else {
      commandItems.value.forEach(item =>
        targets.push({ key: item.id, kind: "command", payload: item })
      );
      historyOptions.value.forEach(item =>
        targets.push({ key: item.path, kind: "history", payload: item })
      );
    }
    return targets;
  };

  // 导航指针 → 子列表 v-model（保持既有渲染组件的选中态/滚动）
  watch(activeNav, key => {
    commandActive.value = key.startsWith("cmd:") ? key : "";
    globalActive.value = key.startsWith("global:") ? key : "";
    if (key.startsWith("global:") || key.startsWith("cmd:")) return;
    if (keyword.value) activePath.value = key;
    else historyPath.value = key;
  });

  const moveNav = (step: number) => {
    const targets = navTargets();
    if (targets.length === 0) return;
    const current = targets.findIndex(target => target.key === activeNav.value);
    const next =
      current === -1
        ? step > 0
          ? 0
          : targets.length - 1
        : (current + step + targets.length) % targets.length;
    const target = targets[next];
    activeNav.value = target.key;
    if (target.kind === "result") {
      const index = resultOptions.value.findIndex(
        item => item.path === target.key
      );
      if (index > -1) scrollTo(index);
    } else if (target.kind === "history") {
      const index = historyOptions.value.findIndex(
        item => item.path === target.key
      );
      if (index > -1) scrollTo(index);
    }
  };

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

  const handleEnter = () => {
    const targets = navTargets();
    const index = targets.findIndex(target => target.key === activeNav.value);
    if (index === -1) return;
    const target = targets[index];
    if (target.kind === "command") {
      runQuickAction(target.key);
      return;
    }
    if (target.kind === "global") {
      goGlobalResult(target.payload as GlobalSearchGroup);
      return;
    }
    if (target.kind === "result") {
      saveHistory();
    } else {
      updateHistory();
    }
    router.push(target.key);
    handleClose();
  };

  const handleUp = () => moveNav(-1);
  const handleDown = () => moveNav(1);

  // 键盘绑定：Esc 由弹窗自身处理
  const stopEnter = onKeyStroke("Enter", handleEnter);
  const stopUp = onKeyStroke("ArrowUp", handleUp);
  const stopDown = onKeyStroke("ArrowDown", handleDown);
  const stopCmdK = onKeyStroke("k", event => {
    if (!(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    activeNav.value = "";
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
    commandActive,
    globalActive,
    activeNav,
    handleEnter,
    handleUp,
    handleDown,
    runQuickAction
  };
}
