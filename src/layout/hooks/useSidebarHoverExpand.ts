import { computed, ref, watch } from "vue";

import { useHoverToggle } from "@/hooks/useHoverToggle";
import type { Ref } from "vue";

/**
 * 侧栏「折叠态悬停临时展开」机制（自 NavVertical 抽出，行为逐字保持）。
 *
 * 语义：折叠态鼠标进入侧栏时视觉层展开、离开即复位；仅 hover 期间生效、
 * 不写回存储。主动折叠 / 展开切换、或门控关闭时复位悬停态，避免残留。
 *
 * 悬停检测延迟取 0（不启用 leaveDelay 防闪断）：本场景「移开即收起」是既有
 * 行为，且展开态还受 hoverExpandEnabled 门控——若离开后快速返回仍在防闪断
 * 窗口内，hover 布尔不产生变化沿，会漏掉期间的门控变化。
 */
export function useSidebarHoverExpand(options: {
  /** 侧栏根节点（模板 ref，悬停检测锚点） */
  rootRef: Ref<HTMLElement | undefined>;
  /** 菜单折叠态（isCollapse） */
  collapsed: Ref<boolean>;
  /** 设备类型（mobile 不启用悬停展开） */
  device: Ref<string>;
  /** 悬停展开门控（站点配置「侧栏悬停展开」，默认开） */
  expandOnHover: () => boolean;
  /** 是否「仅当前一级路由子菜单」形态（该形态不显示折叠态标题） */
  submenuSidebar: Ref<boolean>;
  /** 折叠态显示标题开关（站点配置，仅单列整树侧栏生效） */
  collapsedShowTitle: () => boolean;
}) {
  const [sidebarHovered] = useHoverToggle(options.rootRef, 0);
  const hoverExpanded = ref(false);
  const hoverExpandEnabled = computed(
    () =>
      options.expandOnHover() &&
      options.collapsed.value &&
      options.device.value !== "mobile"
  );

  /** 菜单折叠态：悬停临时展开期间不折叠 */
  const menuCollapse = computed(
    () => options.collapsed.value && !hoverExpanded.value
  );

  /** 折叠态显示菜单标题（设置面板 →「折叠态显示标题」，仅单列整树侧栏） */
  const collapseShowTitle = computed(
    () =>
      !options.submenuSidebar.value &&
      menuCollapse.value &&
      options.collapsedShowTitle()
  );

  watch(sidebarHovered, inside => {
    hoverExpanded.value = inside && hoverExpandEnabled.value;
  });
  // 主动折叠 / 展开切换、或开关关闭时复位悬停态，避免残留
  watch(options.collapsed, () => {
    hoverExpanded.value = false;
  });
  watch(hoverExpandEnabled, enabled => {
    if (!enabled) hoverExpanded.value = false;
  });

  return { sidebarHovered, hoverExpanded, menuCollapse, collapseShowTitle };
}
