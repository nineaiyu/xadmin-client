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
  /** 隐藏标题文字（不需要文字的窄品牌位场景） */
  hideTitle: Boolean,
  /**
   * 紧凑模式（双列侧栏的一级窄列）：图标缩小并与标题水平居中排布——
   * 窄列（80px）放得下「图标 + 站点标题」且不挤压菜单布局。
   */
  compact: Boolean
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
/** Logo 图片显隐（「侧边栏Logo」开关）：与「Logo 文字」正交，只关图片时标题仍在 */
const showLogoImage = computed(() => configure.value?.showLogo ?? true);
const showLogoText = computed(
  () => !props.hideTitle && resolveLogoTextVisible(configure.value)
);
/** 品牌位是否有可见内容：图片与文字都关时整体收起（菜单滚动区随 has-logo 上移） */
const brandVisible = computed(() => showLogoImage.value || showLogoText.value);
const logoStyle = computed(() => resolveLogoImageStyle(configure.value));
</script>

<template>
  <div
    v-if="brandVisible"
    :class="{ collapses: collapse, compact }"
    class="sidebar-logo-container"
  >
    <transition name="sidebarLogoFade">
      <router-link
        v-if="collapse"
        key="collapse"
        :title="title"
        :to="getTopMenu()?.path ?? '/'"
        class="sidebar-logo-link"
        :class="[`logo-mode-${logoMode}`]"
      >
        <img
          v-if="showLogoImage"
          :src="logoSrc"
          :style="logoStyle"
          alt="logo"
        />
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
        <img
          v-if="showLogoImage"
          :src="logoSrc"
          :style="logoStyle"
          alt="logo"
        />
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

/* 紧凑模式（双列侧栏一级窄列的品牌位）：与窄列菜单项同口径的竖排形态——
   图标在上、标题在下，整组居中；窄列（80px）内与菜单项视觉连贯（曾因横排
   贴满列宽而显拥挤）。样式落在本组件内（同 scope），避免父级 scoped 覆盖
   子组件根元素时受样式加载顺序影响（曾导致居中失效、图标偏左）。 */
.sidebar-logo-container.compact .sidebar-logo-link {
  flex-direction: column;
  gap: 2px;
  justify-content: center;
  padding-left: 0;

  img {
    height: var(--nav-item-icon-size-narrow);
  }

  .sidebar-title {
    height: auto;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: var(--font-size-xs);
    line-height: 1.2;
  }
}
</style>
