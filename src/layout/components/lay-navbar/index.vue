<script setup lang="ts">
import { computed } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import { hasNavbarLogo, hasNavbarMenu } from "@/layout/hooks/layoutModes";
import LayNavMix from "../lay-sidebar/NavMix.vue";
import NavbarLogo from "./NavbarLogo.vue";
import LaySidebarBreadCrumb from "../lay-sidebar/components/SidebarBreadCrumb.vue";
import LaySidebarTopCollapse from "../lay-sidebar/components/SidebarTopCollapse.vue";
import NavbarActions from "./NavbarActions.vue";

const { layout, device, pureApp, toggleSideBar } = useNav();

const { $storage } = useGlobal<GlobalPropertiesApi>();

/** 面包屑显隐（设置面板 →「布局」→「顶栏」） */
const breadcrumbVisible = computed(
  () => $storage?.configure?.breadcrumbVisible ?? true
);

/** 顶栏一级菜单条：混合系布局（混合 / 混合双列） */
const headerMenuVisible = computed(() => hasNavbarMenu(layout.value));

/**
 * 顶栏品牌区：Logo 归顶栏的布局（混合 / 侧边导航）——这两种布局的侧栏排在
 * 顶栏下方，没有侧栏顶部品牌位，Logo 随顶栏展示。
 */
const headerLogoVisible = computed(
  () => device.value !== "mobile" && hasNavbarLogo(layout.value)
);

/** 面包屑：仅在无顶栏菜单的模式显示（纵向 / 双列侧栏 / 侧边导航） */
const breadcrumbMode = computed(
  () => !headerMenuVisible.value && device.value !== "mobile"
);

/**
 * 顶栏侧栏折叠按钮（vben `showHeaderToggleButton` 同口径）：
 * 仅「垂直」与「混合双列」两种布局在顶栏展示——双列菜单 / 混合菜单 / 侧边导航
 * 的折叠入口在侧栏自身，水平布局与全屏内容无侧栏。
 */
const headerToggleVisible = computed(
  () =>
    device.value !== "mobile" &&
    (layout.value === "vertical" || layout.value === "header-mixed-nav")
);
</script>

<template>
  <div class="navbar bg-bg-card">
    <LaySidebarTopCollapse
      v-if="device === 'mobile'"
      class="hamburger-container"
      :is-active="pureApp.sidebar.opened"
      @toggleClick="toggleSideBar"
    />

    <NavbarLogo v-if="headerLogoVisible" />

    <LaySidebarTopCollapse
      v-if="headerToggleVisible"
      class="hamburger-container"
      :is-active="pureApp.sidebar.opened"
      @toggleClick="toggleSideBar"
    />

    <template v-if="headerMenuVisible">
      <LayNavMix />
    </template>
    <template v-else>
      <LaySidebarBreadCrumb
        v-if="breadcrumbMode && breadcrumbVisible"
        class="breadcrumb-container"
      />
      <NavbarActions class="vertical-header-right" />
    </template>
  </div>
</template>

<style lang="scss" scoped>
.navbar {
  width: 100%;
  height: var(--layout-header-h);
  overflow: hidden;
  border-bottom: 1px solid hsl(var(--border-light));

  .hamburger-container {
    float: left;
    height: 100%;
    line-height: var(--layout-header-h);
    cursor: pointer;
  }

  .vertical-header-right {
    min-width: 280px;
  }

  .breadcrumb-container {
    float: left;
    margin-left: 16px;
  }
}
</style>
