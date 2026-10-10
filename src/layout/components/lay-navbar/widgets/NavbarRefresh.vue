<script lang="ts" setup>
// 顶栏「刷新当前页」按钮（与页签右键菜单「刷新」同口径）
import { useRoute, useRouter } from "vue-router";
import { useNav } from "@/layout/hooks/useNav";
import { refreshCurrentRoute } from "@/utils/routeRefresh";
import RefreshIcon from "~icons/ep/refresh-right";

const { t } = useNav();
const route = useRoute();
const router = useRouter();

function refreshPage() {
  refreshCurrentRoute(router, {
    fullPath: route.fullPath,
    query: { ...route.query }
  });
}
</script>

<template>
  <span
    id="header-refresh"
    class="navbar-bg-hover hover:[&>svg]:animate-scale-bounce"
    role="button"
    tabindex="0"
    :title="t('layout.refreshPage')"
    :aria-label="t('layout.refreshPage')"
    @click="refreshPage"
    @keydown.enter.prevent="refreshPage"
    @keydown.space.prevent="refreshPage"
  >
    <IconifyIconOffline :icon="RefreshIcon" />
  </span>
</template>
