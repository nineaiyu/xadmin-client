<script lang="ts" setup>
import { computed } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";

import ArrowLeft from "~icons/ri/arrow-left-double-fill";

withDefaults(defineProps<{ isActive?: boolean }>(), {
  isActive: false
});

const { tooltipEffect, t } = useNav();

const iconClass = computed(() => {
  return ["size-4"];
});

const { $storage } = useGlobal<GlobalPropertiesApi>();
const themeColor = computed(() => $storage.layout?.themeColor);

const emit = defineEmits<{
  toggleClick: [];
}>();

const toggleClick = () => {
  emit("toggleClick");
};
</script>

<template>
  <div
    v-tippy="{
      content: isActive ? t('layout.fold') : t('layout.unfold'),
      theme: tooltipEffect,
      hideOnClick: 'toggle',
      placement: 'right'
    }"
    class="center-collapse"
    role="button"
    tabindex="0"
    :aria-label="isActive ? t('layout.fold') : t('layout.unfold')"
    @click="toggleClick"
    @keydown.enter.prevent="toggleClick"
    @keydown.space.prevent="toggleClick"
  >
    <IconifyIconOffline
      :class="[iconClass, themeColor === 'light' ? '' : 'text-primary']"
      :icon="ArrowLeft"
      :style="{ transform: isActive ? 'none' : 'rotateY(180deg)' }"
    />
  </div>
</template>

<style lang="scss" scoped>
.center-collapse {
  position: absolute;
  top: 50%;
  right: var(--space-0-5);
  z-index: var(--z-index-sidebar-ctrl);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 34px;
  cursor: pointer;
  background: var(--el-bg-color);
  border: 1px solid var(--divider);
  border-radius: 4px;
  transform: translate(12px, -50%);
}
</style>
