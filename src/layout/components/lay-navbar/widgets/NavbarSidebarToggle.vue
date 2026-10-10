<script lang="ts" setup>
// 顶栏「折叠侧栏」按钮（设置面板 →「布局」→「顶栏组件」可显隐并参与排序）
import { useNav } from "@/layout/hooks/useNav";
import MenuFoldIcon from "~icons/ri/menu-fold-fill";
import MenuUnfoldIcon from "~icons/ri/menu-unfold-fill";

const { t, pureApp, toggleSideBar } = useNav();
</script>

<template>
  <span
    id="header-sidebar-toggle"
    class="navbar-bg-hover hover:[&>svg]:animate-scale-bounce"
    role="button"
    tabindex="0"
    :title="t('layout.sidebarToggle')"
    :aria-label="t('layout.sidebarToggle')"
    @click="toggleSideBar"
    @keydown.enter.prevent="toggleSideBar"
    @keydown.space.prevent="toggleSideBar"
  >
    <IconifyIconOffline
      :icon="pureApp.sidebar.opened ? MenuFoldIcon : MenuUnfoldIcon"
    />
  </span>
</template>
