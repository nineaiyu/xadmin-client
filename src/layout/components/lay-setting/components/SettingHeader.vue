<script lang="ts" setup>
// 系统设置面板「布局」：顶栏（固定方式、面包屑与顶栏组件显隐）
import { computed } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import { useConfigureStorage } from "../hooks/useConfigureStorage";
import PrefBlock from "./PrefBlock.vue";
import PrefRow from "./PrefRow.vue";

import LayoutTopLine from "~icons/ri/layout-top-line";

const { t } = useNav();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { storageConfigureChange } = useConfigureStorage();

/** 布尔偏好双向绑定：读存储（缺省回落平台默认值），写回响应式存储并触发自动保存 */
function booleanSetting(key: string, fallback: boolean) {
  const configure = () => $storage?.configure as Record<string, unknown>;
  return computed<boolean>({
    get: () => Boolean(configure()?.[key] ?? fallback),
    set: value => storageConfigureChange(key, value)
  });
}

/** 固定顶栏：关闭后顶栏随内容滚动（非固定头布局） */
const headerFixed = booleanSetting("headerFixed", true);
/** 半暗顶栏：浅色外观下顶栏用深色调色板（暗色外观下自动失效） */
const semiDarkHeader = booleanSetting("semiDarkHeader", false);
/** 面包屑显隐（纵向 / 混合布局的顶栏左侧） */
const breadcrumbVisible = booleanSetting("breadcrumbVisible", true);
/** 顶栏组件显隐：菜单搜索 / 语言切换 / 全屏 / 消息通知 / 锁屏 */
const navbarSearch = booleanSetting("navbarSearch", true);
const navbarLanguage = booleanSetting("navbarLanguage", true);
const navbarFullscreen = booleanSetting("navbarFullscreen", true);
const navbarNotice = booleanSetting("navbarNotice", true);
const navbarLock = booleanSetting("navbarLock", true);
</script>

<template>
  <PrefBlock :title="t('layout.header')" :icon="LayoutTopLine" list flush>
    <PrefRow :label="t('layout.headerFixed')" :tip="t('layout.headerFixedTip')">
      <template #control>
        <el-switch
          v-model="headerFixed"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.breadcrumbVisible')"
      :tip="t('layout.breadcrumbVisibleTip')"
    >
      <template #control>
        <el-switch
          v-model="breadcrumbVisible"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
    <PrefRow :label="t('layout.navbarSearch')">
      <template #control>
        <el-switch
          v-model="navbarSearch"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
    <PrefRow :label="t('layout.navbarLanguage')">
      <template #control>
        <el-switch
          v-model="navbarLanguage"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
    <PrefRow :label="t('layout.navbarFullscreen')">
      <template #control>
        <el-switch
          v-model="navbarFullscreen"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
    <PrefRow :label="t('layout.navbarLock')" :tip="t('layout.navbarLockTip')">
      <template #control>
        <el-switch
          v-model="navbarLock"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
    <PrefRow :label="t('layout.navbarNotice')">
      <template #control>
        <el-switch
          v-model="navbarNotice"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.semiDarkHeader')"
      :tip="t('layout.semiDarkHeaderTip')"
    >
      <template #control>
        <el-switch
          v-model="semiDarkHeader"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
  </PrefBlock>
</template>
