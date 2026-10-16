import { computed } from "vue";

/**
 * 侧栏「钉住」按钮机制（自 NavVertical 抽出，行为逐字保持）。
 *
 * 钉住 = 侧栏常驻展开（关掉悬停展开），取消钉住 = 收起重回悬停展开形态。
 * 状态读站点配置（sidebarExpandOnHover / sidebarFixedButton），写入走
 * storageConfigureChange（布局设置的响应式存储），开合动作由调用方注入。
 */
export function useSidebarPinned(options: {
  /** 站点配置读取：侧栏悬停展开（默认开） */
  expandOnHover: () => boolean;
  /** 站点配置读取：钉住按钮显隐（默认关） */
  fixedButton: () => boolean;
  /** 配置写入：侧栏悬停展开（布局设置存储） */
  saveExpandOnHover: (value: boolean) => void;
  /** 侧栏开合控制（含持久化；mode=resize 表示本次为形态调整） */
  toggleSideBar: (value: boolean, mode: "resize") => void;
}) {
  /** 侧栏「钉住」按钮显隐（设置面板 →「钉住按钮」，默认关） */
  const sidebarFixedButton = computed(() => options.fixedButton());
  const pinnedExpanded = computed(() => !options.expandOnHover());

  function toggleFixedExpand() {
    const nextPinned = !pinnedExpanded.value;
    options.saveExpandOnHover(!nextPinned);
    options.toggleSideBar(nextPinned, "resize");
  }

  return { sidebarFixedButton, pinnedExpanded, toggleFixedExpand };
}
