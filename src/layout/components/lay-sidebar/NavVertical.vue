<script setup lang="ts">
import { useRoute } from "vue-router";
import { emitter } from "@/utils/mitt";
import { useNav } from "@/layout/hooks/useNav";
import { responsiveStorageNameSpace } from "@/config";
import { isAllEmpty, storageLocal, useGlobal } from "@pureadmin/utils";
import { usePermissionStoreHook } from "@/store/modules/permission";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { transformI18n } from "@/plugins/i18n";
import { groupMenuChildren } from "@/utils/menuGroups";
import { useSidebarResize } from "@/layout/hooks/useSidebarResize";
import { useSidebarMenu } from "@/layout/hooks/useSidebarMenu";
import { useSplitSidebar } from "@/layout/hooks/useSplitSidebar";
import {
  useMenuScrollActive,
  type ScrollbarExpose
} from "@/layout/hooks/useMenuScrollActive";
import { useHoverToggle } from "@/hooks/useHoverToggle";
import { useConfigureStorage } from "../lay-setting/hooks/useConfigureStorage";
import { hasNavbarLogo, isTwoColumnSidebar } from "@/layout/hooks/layoutModes";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from "vue";
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
const showLogo = ref(
  storageLocal().getItem<StorageConfigs>(
    `${responsiveStorageNameSpace()}configure`
  )?.showLogo ?? true
);

/** 侧栏手风琴：同级菜单只展开一项（默认开，等同项目历史行为） */
const sidebarAccordion = computed(
  () => $storage?.configure?.sidebarAccordion ?? true
);

/** 侧栏底部折叠按钮显隐（默认显示） */
const sidebarCollapseButton = computed(
  () => $storage?.configure?.sidebarCollapseButton ?? true
);

/**
 * 侧栏「钉住」按钮（设置面板 →「钉住按钮」，默认关）：
 * 钉住 = 侧栏常驻展开（关掉悬停展开），取消钉住 = 收起重回悬停展开形态。
 */
const sidebarFixedButton = computed(
  () => $storage?.configure?.sidebarFixedButton ?? false
);
const pinnedExpanded = computed(
  () => !($storage?.configure?.sidebarExpandOnHover ?? true)
);

function toggleFixedExpand() {
  const nextPinned = !pinnedExpanded.value;
  storageConfigureChange("sidebarExpandOnHover", !nextPinned);
  pureApp.toggleSideBar(nextPinned, "resize");
}

const {
  t,
  device,
  pureApp,
  isCollapse,
  tooltipEffect,
  menuSelect,
  toggleSideBar
} = useNav();

/**
 * 折叠态悬停临时展开（设置面板 →「侧栏悬停展开」，默认开）：
 * 鼠标进入侧栏时视觉层展开、离开即复位；仅 hover 期间生效，不写回存储。
 *
 * 延迟取 0（不启用 leaveDelay 防闪断）：本场景「移开即收起」是既有行为，
 * 且展开态还受 `hoverExpandEnabled` 门控——若离开后快速返回仍在防闪断窗口内，
 * hover 布尔不产生变化沿，会漏掉期间的门控变化。
 */
const sidebarRootRef = ref<HTMLElement>();
const [sidebarHovered] = useHoverToggle(sidebarRootRef, 0);
const hoverExpanded = ref(false);
const hoverExpandEnabled = computed(
  () =>
    ($storage?.configure?.sidebarExpandOnHover ?? true) &&
    isCollapse.value &&
    device.value !== "mobile"
);

/** 菜单折叠态：悬停临时展开期间不折叠 */
const menuCollapse = computed(() => isCollapse.value && !hoverExpanded.value);

/** 折叠态显示菜单标题（设置面板 →「折叠态显示标题」，仅单列整树侧栏） */
const collapseShowTitle = computed(
  () =>
    !submenuSidebar.value &&
    menuCollapse.value &&
    ($storage?.configure?.sidebarCollapsedShowTitle ?? false)
);

/** 悬停进入 / 离开：驱动折叠按钮显隐与临时展开 */
watch(sidebarHovered, inside => {
  isShow.value = inside;
  hoverExpanded.value = inside && hoverExpandEnabled.value;
});

// 主动折叠 / 展开切换、或开关关闭时复位悬停态，避免残留
watch(isCollapse, () => {
  hoverExpanded.value = false;
});
watch(hoverExpandEnabled, enabled => {
  if (!enabled) hoverExpanded.value = false;
});

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
const { sidebarMode, splitActive } = useSplitSidebar(defaultActive);
/** 双列侧栏（一级窄列 + 二级展开列） */
const twoColumn = computed(() => isTwoColumnSidebar(sidebarMode.value));
/**
 * 侧栏品牌区可见性：Logo 归顶栏的布局（混合 / 侧边导航）不在侧栏重复渲染，
 * 顶栏被配置隐藏（顶栏整块不渲染）时回落侧栏，避免品牌位整体消失。
 */
const sidebarLogoVisible = computed(
  () =>
    showLogo.value &&
    (!hasNavbarLogo(sidebarMode.value) ||
      ($storage?.configure?.headerHidden ?? false))
);
/** 侧栏只显示「当前一级路由的子菜单」（一级导航在顶栏 / 窄列；受「导航切割」控制） */
const submenuSidebar = splitActive;

/** 菜单数据装配（整树 / 二级列 + 一级高亮与点击），实现见 hooks/useSidebarMenu */
const { menuData, loading, topLevelActive, handleTopLevelSelect } =
  useSidebarMenu(submenuSidebar, defaultActive, menuSelect);

/** 激活项滚入可视区（长菜单下进入深层路由时保持高亮项可见） */
const mainScrollbarRef = ref<ScrollbarExpose>();
const { scrollToActive } = useMenuScrollActive(mainScrollbarRef, [
  () => defaultActive.value,
  () => menuData.value
]);

/** 主列渲染序列：支持一级菜单按 groupName/groupRank 分组（仅影响展示层） */
const topMenuData = computed(() => groupMenuChildren(menuData.value));

/**
 * 子菜单展开后重算滚动定位：EP 会自动展开激活项所在的目录（初始化与路由切换时），
 * 展开事件即「激活项首次渲染」的信号（位置仍会随展开动画变化，hook 内自有重试校正）。
 */
function handleMenuOpen() {
  nextTick(scrollToActive);
}

onMounted(() => {
  scrollToActive();

  emitter.on("logoChange", key => {
    showLogo.value = key;
  });
});

onBeforeUnmount(() => {
  // 解绑`logoChange`公共事件，防止多次触发
  emitter.off("logoChange");
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
        'sidebar-hover-expanded': hoverExpanded,
        'is-resizing': resizing,
        'is-resize-out': resizeOutOfRange
      }
    ]"
  >
    <!-- 双列侧栏的一级窄列：Logo（图标形态）+ 一级图标菜单；二级内容在右侧主列 -->
    <div v-if="twoColumn" class="sidebar-mixed-narrow">
      <LaySidebarLogo
        v-if="sidebarLogoVisible"
        class="sidebar-mixed-narrow__logo"
        collapse
        hide-title
      />
      <el-scrollbar class="sidebar-mixed-narrow__scroll">
        <el-menu
          mode="vertical"
          popper-class="pure-scrollbar"
          class="sidebar-mixed-menu select-none"
          :default-active="topLevelActive"
          :popper-effect="tooltipEffect"
          :unique-opened="sidebarAccordion"
          @select="handleTopLevelSelect"
        >
          <!-- 窄列只显示一级图标（与 vben 的一级窄列同口径）：
               列宽放不下「图标 + 标题」，标题在模板层不渲染（CSS 隐藏受
               scoped/:deep 与组件作用域权重影响不可靠），改由原生 title /
               aria-label 提供悬停提示与可访问名 -->
          <el-menu-item
            v-for="item in usePermissionStoreHook().wholeMenus"
            :key="item.path"
            :index="item.path ?? ''"
            :title="transformI18n(item.meta?.title ?? '')"
            :aria-label="transformI18n(item.meta?.title ?? '')"
          >
            <div v-if="item.meta?.icon" class="sub-menu-icon">
              <component :is="useRenderIcon(item.meta.icon ?? '')" />
            </div>
          </el-menu-item>
        </el-menu>
      </el-scrollbar>
    </div>
    <!-- 侧栏主列：单列模式为整列；双列模式为二级展开列 -->
    <div class="sidebar-main">
      <LaySidebarLogo
        v-if="sidebarLogoVisible && !twoColumn"
        :collapse="menuCollapse"
      />
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
  background: var(--pure-theme-sub-menu-bg);
  border-right: 1px solid var(--divider);
}

.sidebar-mixed-narrow__scroll {
  flex: 1;
  min-height: 0;
}

.sidebar-mixed-narrow__logo {
  flex: none;

  /* 窄列容不下标题文字：标题经 hideTitle 由 Logo 组件自身不渲染（整图形态亦按整图定高居中） */
  :deep(.sidebar-logo-link) {
    justify-content: center;
    padding-left: 0;
  }
}

/* 一级窄列菜单：图标居中（激活项配色沿用公共菜单样式）
   标题在模板层不渲染（见模板注释），此处只负责居中与项高 */
.sidebar-mixed-menu {
  height: 100%;
  border: none;

  :deep(.el-menu-item) {
    justify-content: center;
    height: var(--nav-item-height);
    padding-inline: 0;
  }
}
</style>
