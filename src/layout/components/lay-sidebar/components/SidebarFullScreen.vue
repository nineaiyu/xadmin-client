<script setup lang="ts">
import { ref, watch } from "vue";
import { useNav } from "@/layout/hooks/useNav";

const screenIcon = ref();
const { toggle, isFullscreen, Fullscreen, ExitFullscreen, t } = useNav();

isFullscreen.value = !!(
  document.fullscreenElement ||
  document.webkitFullscreenElement ||
  document.mozFullScreenElement ||
  document.msFullscreenElement
);

watch(
  isFullscreen,
  full => {
    screenIcon.value = full ? ExitFullscreen : Fullscreen;
  },
  {
    immediate: true
  }
);
</script>

<template>
  <span
    class="fullscreen-icon navbar-bg-hover hover:[&>svg]:animate-scale-bounce"
    :title="t('buttons.fullScreenToggle')"
    role="button"
    tabindex="0"
    :aria-label="t('buttons.fullScreenToggle')"
    @click="toggle"
    @keydown.enter.prevent="toggle"
    @keydown.space.prevent="toggle"
  >
    <IconifyIconOffline :icon="screenIcon" />
  </span>
</template>
