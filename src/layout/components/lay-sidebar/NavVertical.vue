<script setup lang="ts">
import { useRoute } from "vue-router";
import { useNav } from "@/layout/hooks/useNav";
import { isAllEmpty, useGlobal } from "@pureadmin/utils";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { transformI18n } from "@/plugins/i18n";
import { useSidebarResize } from "@/layout/hooks/useSidebarResize";
import { useSidebarMenu } from "@/layout/hooks/useSidebarMenu";
import { useSplitSidebar } from "@/layout/hooks/useSplitSidebar";
import {
  useMenuScrollActive,
  type ScrollbarExpose
} from "@/layout/hooks/useMenuScrollActive";
import { useSidebarHoverExpand } from "@/layout/hooks/useSidebarHoverExpand";
import { useSidebarPinned } from "@/layout/hooks/useSidebarPinned";
import { useConfigureStorage } from "../lay-setting/hooks/useConfigureStorage";
import { hasNavbarLogo, isTwoColumnSidebar } from "@/layout/hooks/layoutModes";
import { resolveBrandVisible } from "@/layout/hooks/logoPreferences";
import { useSidebarNarrow } from "@/layout/hooks/useSidebarNarrow";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import LaySidebarLogo from "../lay-sidebar/components/SidebarLogo.vue";
import LaySidebarItem from "../lay-sidebar/components/SidebarItem.vue";
import LaySidebarLeftCollapse from "../lay-sidebar/components/SidebarLeftCollapse.vue";
import LaySidebarCenterCollapse from "../lay-sidebar/components/SidebarCenterCollapse.vue";
import PushpinIcon from "~icons/ri/pushpin-line";
import PushpinActiveIcon from "~icons/ri/pushpin-2-line";

const route = useRoute();
const isShow = ref(false);
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { storageConfigureChange } = useConfigureStorage();

/** 侧栏手风琴：同级菜单只展开一项（默认开，等同项目历史行为） */
const sidebarAccordion = computed(
  () => $storage?.configure?.sidebarAccordion ?? true
);

/** 侧栏底部折叠按钮显隐（默认显示） */
const sidebarCollapseButton = computed(
  () => $storage?.configure?.sidebarCollapseButton ?? true
);

const {
  t,
  device,
  pureApp,
  isCollapse,
  tooltipEffect,
  menuSelect,
  toggleSideBar
} = useNav();

/** 侧栏「钉住」按钮（设置面板 →「钉住按钮」，默认关；实现见 hooks/useSidebarPinned） */
const { sidebarFixedButton, pinnedExpanded, toggleFixedExpand } =
  useSidebarPinned({
    expandOnHover: () => $storage?.configure?.sidebarExpandOnHover ?? true,
    fixedButton: () => $storage?.configure?.sidebarFixedButton ?? false,
    saveExpandOnHover: value =>
      storageConfigureChange("sidebarExpandOnHover", value),
    toggleSideBar: (value, mode) => pureApp.toggleSideBar(value, mode)
  });

/** 侧栏根节点（折叠态悬停展开的检测锚点，模板 ref） */
const sidebarRootRef = ref<HTMLElement>();

/** 拖拽调宽：实现见 hooks/useSidebarResize（越界态视觉反馈 + 松开才落库） */
const {
  draggable: sidebarDraggable,
  resizing,
  resizeOutOfRange,
  startResize
} = useSidebarResize(
  () =>
    ($storage?.configure?.sidebarDraggable ?? false) &&
    !isCollapse.value &&
    device.value !== "mobile"
);

const defaultActive = computed(() =>
  !isAllEmpty(route.meta?.activePath) ? route.meta.activePath : route.path
);

/** 侧栏语义模式 + 切割形态（口径见 useSplitSidebar，与外壳守卫同一来源） */
const { sidebarMode, splitActive, splitMenus } = useSplitSidebar(defaultActive);
/** 双列侧栏（一级窄列 + 二级展开列） */
const twoColumn = computed(() => isTwoColumnSidebar(sidebarMode.value));

/**
 * 侧栏品牌位可见性：Logo 归顶栏的布局（混合 / 侧边导航）不在侧栏重复渲染，
 * 顶栏被配置隐藏（顶栏整块不渲染）时回落侧栏，避免品牌位整体消失。
 * 品牌内容显隐（图片 / 标题两个正交开关）由 resolveBrandVisible 统一判定，
 * 同时决定 `has-logo` / `no-logo`（菜单滚动区高度）。
 */
const sidebarLogoVisible = computed(
  () =>
    resolveBrandVisible($storage?.configure) &&
    (!hasNavbarLogo(sidebarMode.value) ||
      ($storage?.configure?.headerHidden ?? false))
);
/** 侧栏只显示「当前一级路由的子菜单」（一级导航在顶栏 / 窄列；受「导航切割」控制） */
const submenuSidebar = splitActive;

/** 折叠态悬停临时展开（设置面板 →「侧栏悬停展开」，默认开；实现见 hooks/useSidebarHoverExpand） */
const { sidebarHovered, hoverExpanded, menuCollapse, collapseShowTitle } =
  useSidebarHoverExpand({
    rootRef: sidebarRootRef,
    collapsed: isCollapse,
    device,
    expandOnHover: () => $storage?.configure?.sidebarExpandOnHover ?? true,
    submenuSidebar,
    collapsedShowTitle: () =>
      $storage?.configure?.sidebarCollapsedShowTitle ?? false
  });

/** 悬停进入 / 离开：驱动折叠按钮显隐 */
watch(sidebarHovered, inside => {
  isShow.value = inside;
});

/** 菜单数据装配（整树 / 二级列 + 一级高亮），实现见 hooks/useSidebarMenu */
const { menuData, loading, topLevelActive } = useSidebarMenu(
  submenuSidebar,
  defaultActive,
  menuSelect
);

/** 激活项滚入可视区（长菜单下进入深层路由时保持高亮项可见） */
const mainScrollbarRef = ref<ScrollbarExpose>();
const { scrollToActive } = useMenuScrollActive(mainScrollbarRef, [
  () => defaultActive.value,
  () => menuData.value
]);

/** 双列窄列的数据与交互（窄列菜单装配 + 混合双列的悬停联动），实现见 hooks/useSidebarNarrow */
const {
  narrowMenuData,
  extraVisible,
  narrowActive,
  handleNarrowMouseEnter,
  handleNarrowMouseLeave,
  handleNarrowSelect,
  topMenuData
} = useSidebarNarrow(
  sidebarMode,
  splitMenus,
  defaultActive,
  topLevelActive,
  menuData
);

/** 双列次级列的分区标题：当前激活的一级菜单（vben side-extra-title 同口径） */
const activeTopMenu = computed(() => {
  const path = topLevelActive.value;
  return (
    [...topMenuData.value, ...narrowMenuData.value].find(
      item => item.path === path
    ) ?? null
  );
});
const activeTopMenuTitle = computed(() =>
  transformI18n(activeTopMenu.value?.meta?.title ?? "")
);
const activeTopMenuIcon = computed(() => activeTopMenu.value?.meta?.icon ?? "");

/**
 * 子菜单展开后重算滚动定位：EP 会自动展开激活项所在的目录（初始化与路由切换时），
 * 展开事件即「激活项首次渲染」的信号（位置仍会随展开动画变化，hook 内自有重试校正）。
 */
function handleMenuOpen() {
  nextTick(scrollToActive);
}

onMounted(() => {
  scrollToActive();
});
</script>

<template>
  <div
    ref="sidebarRootRef"
    v-loading="loading"
    :class="[
      'sidebar-container',
      sidebarLogoVisible ? 'has-logo' : 'no-logo',
      {
        'is-two-column': twoColumn,
        'is-narrow-only': twoColumn && !extraVisible,
        'sidebar-hover-expanded': hoverExpanded,
        'is-resizing': resizing,
        'is-resize-out': resizeOutOfRange
      }
    ]"
    @mouseleave="handleNarrowMouseLeave"
  >
    <!-- 双列侧栏的一级窄列：Logo（图标 + 站点标题的紧凑形态，居中）+ 一级图标菜单；
         二级内容在右侧主列 -->
    <div v-if="twoColumn" class="sidebar-mixed-narrow">
      <LaySidebarLogo
        v-if="sidebarLogoVisible"
        class="sidebar-mixed-narrow__logo"
        collapse
        compact
      />
      <el-scrollbar class="sidebar-mixed-narrow__scroll">
        <el-menu
          mode="vertical"
          popper-class="pure-scrollbar"
          class="sidebar-mixed-menu select-none"
          :default-active="narrowActive"
          :popper-effect="tooltipEffect"
          :unique-opened="sidebarAccordion"
          @select="handleNarrowSelect"
        >
          <!-- 窄列菜单（图标在上、标题在下，vben 一级窄列同口径）：
               双列菜单为全局一级菜单；混合双列为当前一级的子菜单（悬停联动主列） -->
          <el-menu-item
            v-for="item in narrowMenuData"
            :key="item.path"
            :index="item.path ?? ''"
            :aria-label="transformI18n(item.meta?.title ?? '')"
            @mouseenter="handleNarrowMouseEnter(item as never)"
          >
            <div v-if="item.meta?.icon" class="sub-menu-icon">
              <component :is="useRenderIcon(item.meta.icon ?? '')" />
            </div>
            <span class="sidebar-mixed-narrow__name">{{
              transformI18n(item.meta?.title ?? "")
            }}</span>
          </el-menu-item>
        </el-menu>
      </el-scrollbar>
    </div>
    <!-- 侧栏主列：单列模式为整列；双列模式为二级展开列（次级菜单无内容时不渲染——
         混合双列是窄列项没有子级，双列菜单是当前一级为叶子菜单（如「关于」）——
         侧栏收为窄列宽度，与 vben 的 extra 隐藏同口径） -->
    <div v-if="!twoColumn || extraVisible" class="sidebar-main">
      <LaySidebarLogo
        v-if="sidebarLogoVisible && !twoColumn"
        :collapse="menuCollapse"
      />
      <!-- 双列侧栏次级列的分区标题（vben side-extra-title 同口径）：当前一级菜单的
           图标 + 标题；站点 Logo 只在一级窄列顶部出现一次，不在此重复品牌 -->
      <div v-else-if="twoColumn" class="sidebar-mixed-brand">
        <div v-if="activeTopMenuIcon" class="sub-menu-icon">
          <component :is="useRenderIcon(activeTopMenuIcon)" />
        </div>
        <span class="sidebar-mixed-brand__title">
          {{ activeTopMenuTitle }}
        </span>
      </div>
      <el-scrollbar
        ref="mainScrollbarRef"
        wrap-class="scrollbar-wrapper"
        :class="[device === 'mobile' ? 'mobile' : 'pc']"
      >
        <el-menu
          :unique-opened="sidebarAccordion"
          mode="vertical"
          popper-class="pure-scrollbar"
          class="outer-most select-none"
          :class="{ 'sidebar-collapse-show-title': collapseShowTitle }"
          :collapse="menuCollapse"
          :popper-effect="tooltipEffect"
          :default-active="defaultActive"
          :show-timeout="300"
          :hide-timeout="300"
          @open="handleMenuOpen"
        >
          <LaySidebarItem
            v-for="routes in topMenuData"
            :key="routes.path"
            :item="routes as never"
            :base-path="routes.path"
            :collapse="menuCollapse"
            class="outer-most select-none"
          />
        </el-menu>
      </el-scrollbar>
      <LaySidebarCenterCollapse
        v-if="
          sidebarCollapseButton && device !== 'mobile' && (isShow || isCollapse)
        "
        :is-active="pureApp.sidebar.opened"
        @toggleClick="toggleSideBar"
      />
      <LaySidebarLeftCollapse
        v-if="device !== 'mobile'"
        :is-active="pureApp.sidebar.opened"
        @toggleClick="toggleSideBar"
      />
      <span
        v-if="sidebarFixedButton && device !== 'mobile'"
        class="sidebar-fixed-button"
        :class="{ 'is-pinned': pinnedExpanded }"
        role="button"
        tabindex="0"
        :title="t('layout.sidebarFixedButton')"
        :aria-label="t('layout.sidebarFixedButton')"
        @click="toggleFixedExpand"
        @keydown.enter.prevent="toggleFixedExpand"
        @keydown.space.prevent="toggleFixedExpand"
      >
        <IconifyIconOffline
          :icon="pinnedExpanded ? PushpinActiveIcon : PushpinIcon"
        />
      </span>
    </div>
    <!-- 拖拽调宽把手：仅展开态 + 拖拽开关开启时渲染（贴侧栏右缘） -->
    <div
      v-if="sidebarDraggable"
      class="sidebar-resizer"
      role="separator"
      aria-orientation="vertical"
      :aria-label="t('layout.sidebarWidth')"
      @mousedown.prevent="startResize"
    />
  </div>
</template>

<style scoped>
:deep(.el-loading-mask) {
  opacity: 0.45;
}

/* 钉住展开按钮：贴在底部折叠条上方（折叠态下仍居中可辨） */
.sidebar-fixed-button {
  position: absolute;
  right: 10px;
  bottom: 46px;
  z-index: 1002;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  color: var(--pure-theme-menu-text, var(--el-text-color-secondary));
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: color var(--duration-fast) var(--ease-standard);

  &:hover,
  &.is-pinned {
    color: var(--el-color-primary);
  }
}

/* 拖拽调宽把手：贴右缘的窄条，悬停 / 拖拽时显示主色细线 */
.sidebar-resizer {
  position: absolute;
  top: 0;
  right: -2px;
  z-index: 10;
  width: 6px;
  height: 100%;
  cursor: col-resize;

  &::after {
    position: absolute;
    top: 0;
    left: 3px;
    width: 1px;
    height: 100%;
    content: "";
    background: transparent;
    transition: background var(--duration-fast) var(--ease-standard);
  }

  &:hover::after {
    background: var(--el-color-primary);
  }
}

.is-resizing .sidebar-resizer::after {
  background: var(--el-color-primary);
}

/* 拖拽越界：把手光标变为禁止态、指示线转为警示色（越界松手仍按钳制值落库） */
.is-resize-out .sidebar-resizer {
  cursor: not-allowed;

  &::after {
    background: var(--el-color-warning);
  }
}

/* ================ 双列侧栏（导航模式 → 双列 / 混合双列） ================
   一级窄列（图标）+ 二级展开列并排；单列模式下 .sidebar-main 即整列 */
.sidebar-container.is-two-column {
  display: flex;
  flex-direction: row;
}

.sidebar-main {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  overflow: hidden;
}

.sidebar-mixed-narrow {
  display: flex;
  flex: none;
  flex-direction: column;
  width: var(--sidebar-mixed-narrow-width);
  height: 100%;
  overflow: hidden;
  border-right: 1px solid var(--divider);
}

.sidebar-mixed-narrow__scroll {
  flex: 1;
  min-height: 0;
}

.sidebar-mixed-narrow__logo {
  flex: none;

  /* 紧凑形态（图标缩小 + 标题同排居中）由 Logo 组件的 compact 模式实现——样式落在
     SidebarLogo 内部（同 scope），此处不再跨组件覆盖（scoped :deep 与子组件
     同特异性时受样式加载顺序影响，曾导致居中失效、图标偏左） */
}

/* 一级窄列菜单本体（项形态见 style/sidebar/_sidebar-narrow.scss：竖排、实心激活块） */
.sidebar-mixed-menu {
  height: 100%;
  border: none;
}

/* 双列次级列分区标题：与窄列 Logo 区同高（顶部基线对齐），左对齐弱化呈现 */
.sidebar-mixed-brand {
  display: flex;
  flex: none;
  gap: var(--nav-item-icon-gap);
  align-items: center;
  height: var(--sidebar-logo-h);
  padding: 0 var(--space-4);
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--pure-theme-menu-text);

  .sub-menu-icon {
    flex: none;
    height: var(--nav-item-icon-size);

    svg {
      width: var(--nav-item-icon-size);
      height: var(--nav-item-icon-size);
    }
  }
}

.sidebar-mixed-brand__title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
