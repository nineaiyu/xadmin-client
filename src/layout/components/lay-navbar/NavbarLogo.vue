<script setup lang="ts">
// 顶栏品牌区（Logo 归顶栏的混合系布局：混合 / 侧边导航）：
// 图源 / 形态 / 标题与侧栏 Logo 共用同一套取值口径（layout/hooks/logoPreferences），
// 显隐跟随「侧栏 Logo」开关（跨组件经 emitter 同步），点击回首页。
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { storageLocal, useDark, useGlobal } from "@pureadmin/utils";
import { responsiveStorageNameSpace } from "@/config";
import { getTopMenu } from "@/router/utils";
import { emitter } from "@/utils/mitt";
import { useNav } from "@/layout/hooks/useNav";
import {
  resolveLogoImageStyle,
  resolveLogoMode,
  resolveLogoSrc,
  resolveLogoTextVisible
} from "@/layout/hooks/logoPreferences";

const { title, getLogo } = useNav();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { isDark } = useDark();

const showLogo = ref(
  storageLocal().getItem<StorageConfigs>(
    `${responsiveStorageNameSpace()}configure`
  )?.showLogo ?? true
);

const configure = computed(() => $storage?.configure);
const logoSrc = computed(() =>
  resolveLogoSrc(configure.value, getLogo(), Boolean(isDark.value))
);
const logoMode = computed(() => resolveLogoMode(configure.value));
const showLogoText = computed(() => resolveLogoTextVisible(configure.value));
const logoStyle = computed(() => resolveLogoImageStyle(configure.value));

onMounted(() => {
  emitter.on("logoChange", key => {
    showLogo.value = key;
  });
});

onBeforeUnmount(() => {
  emitter.off("logoChange");
});
</script>

<template>
  <router-link
    v-if="showLogo"
    :title="title"
    :to="getTopMenu()?.path ?? '/'"
    class="navbar-logo"
    :class="[`logo-mode-${logoMode}`]"
  >
    <img :src="logoSrc" :style="logoStyle" alt="logo" />
    <span v-if="showLogoText" class="navbar-logo__title">{{ title }}</span>
  </router-link>
</template>

<style scoped>
.navbar-logo {
  display: flex;
  flex: none;
  flex-wrap: nowrap;
  align-items: center;
  height: 100%;
  padding: 0 16px 0 12px;
  transition: background var(--duration-fast) var(--ease-standard);

  &:hover {
    background: var(--pure-theme-menu-hover);
  }

  img {
    display: inline-block;
    height: 32px;
  }
}

.navbar-logo__title {
  display: inline-block;
  height: 32px;
  margin: 2px 0 0 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--font-size-lg);
  font-weight: 600;
  line-height: 32px;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}
</style>
