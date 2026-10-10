<script lang="ts" setup>
// 系统设置面板「布局」：侧边栏（手风琴、折叠按钮显隐、侧栏 Logo、侧栏宽度、半暗侧栏）
import { computed, ref } from "vue";
import { useDark, useGlobal } from "@pureadmin/utils";
import { emitter } from "@/utils/mitt";
import { useNav } from "@/layout/hooks/useNav";
import {
  DEFAULT_SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_RANGE,
  normalizeSidebarWidth
} from "@/layout/hooks/usePreferenceAttributes";
import { useConfigureStorage } from "../hooks/useConfigureStorage";
import PrefBlock from "./PrefBlock.vue";
import PrefRow from "./PrefRow.vue";

import SidebarLine from "~icons/ri/side-bar-line";

const { t } = useNav();
const { isDark } = useDark();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { storageConfigureChange } = useConfigureStorage();

/** 侧栏宽度：写入 `--sidebar-width`（usePreferenceAttributes 同步到 <html>） */
const sidebarWidth = computed<number>({
  get: () => $storage?.configure?.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH,
  set: value =>
    storageConfigureChange("sidebarWidth", normalizeSidebarWidth(value))
});

/** 侧栏 Logo：侧栏组件按 emitter 事件同步（与既有实现一致） */
const logoVal = ref($storage.configure?.showLogo ?? true);

/** 侧栏手风琴：同级菜单只展开一项（NavVertical 的 el-menu unique-opened） */
const sidebarAccordion = computed({
  get: () => $storage?.configure?.sidebarAccordion ?? true,
  set: value => storageConfigureChange("sidebarAccordion", value)
});

/** 侧栏底部折叠按钮显隐 */
const sidebarCollapseButton = computed({
  get: () => $storage?.configure?.sidebarCollapseButton ?? true,
  set: value => storageConfigureChange("sidebarCollapseButton", value)
});

/** 半暗侧栏：浅色外观下让侧栏保持深色（暗色外观本身即深色，无需此档） */
const semiDarkSidebar = computed({
  get: () => $storage?.configure?.semiDarkSidebar ?? false,
  set: value => storageConfigureChange("semiDarkSidebar", value)
});

function logoChange() {
  storageConfigureChange("showLogo", logoVal.value);
  emitter.emit("logoChange", logoVal.value);
}
</script>

<template>
  <PrefBlock :title="t('layout.sidebar')" :icon="SidebarLine" list flush>
    <PrefRow
      :label="t('layout.sidebarAccordion')"
      :tip="t('layout.sidebarAccordionTip')"
    >
      <template #control>
        <el-switch
          v-model="sidebarAccordion"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.sidebarCollapseButton')"
      :tip="t('layout.sidebarCollapseButtonTip')"
    >
      <template #control>
        <el-switch
          v-model="sidebarCollapseButton"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
    <PrefRow :label="t('layout.sidebarLogo')">
      <template #control>
        <el-switch
          v-model="logoVal"
          :active-text="t('labels.active')"
          :active-value="true"
          :inactive-text="t('labels.inactive')"
          :inactive-value="false"
          inline-prompt
          @change="logoChange"
        />
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.semiDarkSidebar')"
      :tip="t('layout.semiDarkSidebarTip')"
      :disabled="isDark"
    >
      <template #control>
        <el-switch
          v-model="semiDarkSidebar"
          :active-text="t('labels.active')"
          :disabled="isDark"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.sidebarWidth')"
      :tip="t('layout.sidebarWidthTip')"
    >
      <template #control>
        <el-input-number
          v-model="sidebarWidth"
          :min="SIDEBAR_WIDTH_RANGE.min"
          :max="SIDEBAR_WIDTH_RANGE.max"
          :step="10"
          size="small"
          controls-position="right"
          style="width: 108px"
        />
      </template>
    </PrefRow>
  </PrefBlock>
</template>
