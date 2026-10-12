<script setup lang="ts">
import { computed } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import { hasHeaderMenu } from "@/layout/hooks/layoutModes";
import LayNavMix from "../lay-sidebar/NavMix.vue";
import LaySidebarBreadCrumb from "../lay-sidebar/components/SidebarBreadCrumb.vue";
import LaySidebarTopCollapse from "../lay-sidebar/components/SidebarTopCollapse.vue";
import NavbarActions from "./NavbarActions.vue";

const { layout, device, pureApp, toggleSideBar } = useNav();

const { $storage } = useGlobal<GlobalPropertiesApi>();

/** 面包屑显隐（设置面板 →「布局」→「顶栏」） */
const breadcrumbVisible = computed(
  () => $storage?.configure?.breadcrumbVisible ?? true
);

/** 顶栏一级菜单条：混合系布局（mix / header-sidebar-nav / header-mixed-nav） */
const headerMenuVisible = computed(() => hasHeaderMenu(layout.value));

/** 面包屑：仅在无顶栏菜单的模式显示（纵向 / 双列侧栏） */
const breadcrumbMode = computed(
  () => !headerMenuVisible.value && device.value !== "mobile"
);
</script>

<template>
  <div class="navbar bg-bg-card shadow-(--shadow-navbar)">
    <LaySidebarTopCollapse
      v-if="device === 'mobile'"
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
  height: 48px;
  overflow: hidden;

  .hamburger-container {
    float: left;
    height: 100%;
    line-height: 48px;
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
