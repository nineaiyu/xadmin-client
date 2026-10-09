import { ref, watch, type ComputedRef, type Ref, type ShallowRef } from "vue";
import type { Router } from "vue-router";
import type { GlobalSearchGroup } from "@/api/system/search";
import type { NavTarget } from "./commandPaletteRegistry";
import type { optionsItem } from "./types";

/**
 * 命令面板键盘导航（自 useCommandPalette.ts 抽出）：唯一导航指针
 * （cmd:xx / 菜单路径 / global:<组>:<pk> / 历史路径）串联快捷动作、菜单结果、
 * 全局搜索分组与历史记录，↑↓ 循环移动、Enter 执行。
 */
export function createNavController({
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
}: {
  router: Router;
  commandItems: ComputedRef<{ id: string; title: string; route?: string }[]>;
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
  runQuickAction: (id: string) => void;
}) {
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

  return {
    activeNav,
    commandActive,
    globalActive,
    handleEnter,
    handleUp: () => moveNav(-1),
    handleDown: () => moveNav(1)
  };
}
