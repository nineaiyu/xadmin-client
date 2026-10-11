<script lang="ts" setup>
import { computed, type CSSProperties } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { getTopMenu } from "@/router/utils";
import { useNav } from "@/layout/hooks/useNav";

defineProps({
  collapse: Boolean
});

const { title, getLogo } = useNav();
const { $storage } = useGlobal<GlobalPropertiesApi>();

/** 自定义 Logo 地址（设置面板 →「Logo 图片」），缺省用内置资源 */
const logoSrc = computed(() => $storage?.configure?.logoSource || getLogo());
/** 是否在 Logo 右侧显示平台标题 */
const showLogoText = computed(() => $storage?.configure?.logoShowText ?? true);
/** 图片填充方式（object-fit） */
const logoFit = computed(() => $storage?.configure?.logoFit ?? "contain");
const logoStyle = computed<CSSProperties>(() => ({
  objectFit: logoFit.value as CSSProperties["objectFit"]
}));
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
  height: 48px;
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
  }
}
</style>
