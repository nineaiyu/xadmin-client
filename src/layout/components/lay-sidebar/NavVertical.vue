<script setup lang="ts">
import { useRoute, type RouteRecordRaw } from "vue-router";
import { emitter } from "@/utils/mitt";
import { useNav } from "@/layout/hooks/useNav";
import { responsiveStorageNameSpace } from "@/config";
import { isAllEmpty, storageLocal, useGlobal } from "@pureadmin/utils";
import { findRouteByPath, getParentPaths } from "@/router/utils";
import { usePermissionStoreHook } from "@/store/modules/permission";
import {
  DEFAULT_SIDEBAR_WIDTH,
  normalizeSidebarWidth
} from "@/layout/hooks/usePreferenceAttributes";
import { useConfigureStorage } from "../lay-setting/hooks/useConfigureStorage";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
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
  layout,
  pureApp,
  isCollapse,
  tooltipEffect,
  menuSelect,
  toggleSideBar
} = useNav();

/**
 * 折叠态悬停临时展开（设置面板 →「侧栏悬停展开」，默认开）：
 * 鼠标进入侧栏时视觉层展开、离开复位；仅 hover 期间生效，不写回存储。
 */
const hoverExpanded = ref(false);
const hoverExpandEnabled = computed(
  () =>
    ($storage?.configure?.sidebarExpandOnHover ?? true) &&
    isCollapse.value &&
    device.value !== "mobile"
);

/** 菜单折叠态：悬停临时展开期间不折叠 */
const menuCollapse = computed(() => isCollapse.value && !hoverExpanded.value);

/** 折叠态显示菜单标题（设置面板 →「折叠态显示标题」，仅垂直布局） */
const collapseShowTitle = computed(
  () =>
    layout.value === "vertical" &&
    menuCollapse.value &&
    ($storage?.configure?.sidebarCollapsedShowTitle ?? false)
);

// 主动折叠 / 展开切换、或开关关闭时复位悬停态，避免残留
watch(isCollapse, () => {
  hoverExpanded.value = false;
});
watch(hoverExpandEnabled, enabled => {
  if (!enabled) hoverExpanded.value = false;
});

function onSidebarEnter() {
  isShow.value = true;
  if (hoverExpandEnabled.value) hoverExpanded.value = true;
}

function onSidebarLeave() {
  isShow.value = false;
  hoverExpanded.value = false;
}

/**
 * 拖拽调宽（设置面板 →「侧栏拖拽」，默认关）：拖拽中只改 `--sidebar-width`
 * CSS 变量不落库，松开时才写回偏好（钳制在区间内，数字输入档仍可精确设置）。
 */
const resizing = ref(false);
const sidebarDraggable = computed(
  () =>
    ($storage?.configure?.sidebarDraggable ?? false) &&
    !isCollapse.value &&
    device.value !== "mobile"
);

function startResize(event: MouseEvent) {
  if (resizing.value) return;
  resizing.value = true;
  const startX = event.clientX;
  const startWidth = normalizeSidebarWidth(
    $storage?.configure?.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH
  );
  const widthAt = (clientX: number) =>
    normalizeSidebarWidth(startWidth + (clientX - startX));

  document.body.style.userSelect = "none";
  document.body.style.cursor = "col-resize";

  const onMove = (moveEvent: MouseEvent) => {
    document.documentElement.style.setProperty(
      "--sidebar-width",
      `${widthAt(moveEvent.clientX)}px`
    );
  };
  const onUp = (upEvent: MouseEvent) => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    resizing.value = false;
    storageConfigureChange("sidebarWidth", widthAt(upEvent.clientX));
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

const subMenuData = ref<RouteRecordRaw[]>([]);

const menuData = computed(() => {
  return pureApp.layout === "mix" && device.value !== "mobile"
    ? subMenuData.value
    : usePermissionStoreHook().wholeMenus;
});

const loading = computed(() =>
  pureApp.layout === "mix" ? false : menuData.value.length === 0 ? true : false
);

const defaultActive = computed(() =>
  !isAllEmpty(route.meta?.activePath) ? route.meta.activePath : route.path
);

function getSubMenuData() {
  let path = defaultActive.value;
  subMenuData.value = [];
  // path的上级路由组成的数组
  const parentPathArr = getParentPaths(
    path,
    usePermissionStoreHook().wholeMenus as never
  );
  // 当前路由的父级路由信息
  const parenetRoute = findRouteByPath(
    parentPathArr[0] || path,
    usePermissionStoreHook().wholeMenus as never
  );
  if (!parenetRoute?.children) return;
  subMenuData.value = parenetRoute?.children;
}

watch(
  () => [route.path, usePermissionStoreHook().wholeMenus],
  () => {
    if (route.path.includes("/redirect")) return;
    getSubMenuData();
    menuSelect(route.path);
  }
);

onMounted(() => {
  getSubMenuData();

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
    v-loading="loading"
    :class="[
      'sidebar-container',
      showLogo ? 'has-logo' : 'no-logo',
      { 'sidebar-hover-expanded': hoverExpanded, 'is-resizing': resizing }
    ]"
    @mouseenter.prevent="onSidebarEnter"
    @mouseleave.prevent="onSidebarLeave"
  >
    <LaySidebarLogo v-if="showLogo" :collapse="menuCollapse" />
    <el-scrollbar
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
        :collapse-transition="false"
        :popper-effect="tooltipEffect"
        :default-active="defaultActive"
      >
        <LaySidebarItem
          v-for="routes in menuData"
          :key="routes.path"
          :item="routes as never"
          :base-path="routes.path"
          :collapse="menuCollapse"
          class="outer-most select-none"
        />
      </el-menu>
    </el-scrollbar>
    <!-- 拖拽调宽把手：仅展开态 + 拖拽开关开启时渲染 -->
    <div
      v-if="sidebarDraggable"
      class="sidebar-resizer"
      role="separator"
      aria-orientation="vertical"
      :aria-label="t('layout.sidebarWidth')"
      @mousedown.prevent="startResize"
    />
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
</style>
