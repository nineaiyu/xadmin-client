<script lang="ts" setup>
import { computed } from "vue";
import { useDark, useGlobal } from "@pureadmin/utils";
import { getTopMenu } from "@/router/utils";
import { useNav } from "@/layout/hooks/useNav";
import {
  resolveLogoImageStyle,
  resolveLogoMode,
  resolveLogoSrc,
  resolveLogoTextVisible
} from "@/layout/hooks/logoPreferences";

const props = defineProps({
  collapse: Boolean,
  /** 隐藏标题文字（双列侧栏的一级窄列：列宽放不下标题，仅保留图标） */
  hideTitle: Boolean
});

const { title, getLogo } = useNav();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { isDark } = useDark();

const configure = computed(() => $storage?.configure);
/** 图源（暗色专用图优先，缺省用内置资源） */
const logoSrc = computed(() =>
  resolveLogoSrc(configure.value, getLogo(), Boolean(isDark.value))
);
/** 整图模式：图片含图标与文字，标题文字不再单独渲染、图片按偏好定高 */
const logoMode = computed(() => resolveLogoMode(configure.value));
const showLogoText = computed(
  () => !props.hideTitle && resolveLogoTextVisible(configure.value)
);
const logoStyle = computed(() => resolveLogoImageStyle(configure.value));
</script>

<template>
  <div :class="{ collapses: collapse }" class="sidebar-logo-container">
    <transition name="sidebarLogoFade">
      <router-link
        v-if="collapse"
        key="collapse"
        :title="title"
        :to="getTopMenu()?.path ?? '/'"
        class="sidebar-logo-link"
        :class="[`logo-mode-${logoMode}`]"
      >
        <img :src="logoSrc" :style="logoStyle" alt="logo" />
        <span v-if="showLogoText" class="sidebar-title">{{ title }}</span>
      </router-link>
      <router-link
        v-else
        key="expand"
        :title="title"
        :to="getTopMenu()?.path ?? '/'"
        class="sidebar-logo-link"
        :class="[`logo-mode-${logoMode}`]"
      >
        <img :src="logoSrc" :style="logoStyle" alt="logo" />
        <span v-if="showLogoText" class="sidebar-title">{{ title }}</span>
      </router-link>
    </transition>
  </div>
</template>

<style lang="scss" scoped>
.sidebar-logo-container {
  position: relative;
  width: 100%;
  height: var(--sidebar-logo-h);
  overflow: hidden;

  .sidebar-logo-link {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    height: 100%;
    padding-left: 10px;

    img {
      display: inline-block;
      height: 32px;
    }

    .sidebar-title {
      display: inline-block;
      height: 32px;
      margin: 2px 0 0 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: var(--font-size-lg);
      font-weight: 600;
      line-height: 32px;
      color: var(--pure-theme-sub-menu-active-text);
      white-space: nowrap;
    }

    /* 整图模式：图片按偏好定高（行内样式），折叠态下亦保持整图可辨 */
    &.logo-mode-full {
      justify-content: flex-start;
    }
  }
}
</style>
