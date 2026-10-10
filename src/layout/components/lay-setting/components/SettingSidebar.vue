<script lang="ts" setup>
// 系统设置面板「布局」：侧边栏（手风琴、折叠按钮显隐、侧栏 Logo、侧栏宽度、半暗侧栏）
import { computed, ref } from "vue";
import { useDark, useGlobal } from "@pureadmin/utils";
import { emitter } from "@/utils/mitt";
import { useNav } from "@/layout/hooks/useNav";
import {
  DEFAULT_SIDEBAR_COLLAPSE_WIDTH,
  DEFAULT_SIDEBAR_WIDTH,
  SIDEBAR_COLLAPSE_WIDTH_RANGE,
  SIDEBAR_MIXED_WIDTH_RANGE,
  SIDEBAR_WIDTH_RANGE,
  normalizeSidebarCollapseWidth,
  normalizeSidebarMixedWidth,
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

/** 半暗子侧栏：仅混合布局的侧栏（第二列）存在该形态 */
const isMixLayout = computed(() =>
  String($storage?.layout?.layout ?? "vertical").includes("mix")
);
const semiDarkSidebarSub = computed({
  get: () => $storage?.configure?.semiDarkSidebarSub ?? false,
  set: value => storageConfigureChange("semiDarkSidebarSub", value)
});

/** 折叠态悬停临时展开（仅视觉层，不写回存储） */
const sidebarExpandOnHover = computed({
  get: () => $storage?.configure?.sidebarExpandOnHover ?? true,
  set: value => storageConfigureChange("sidebarExpandOnHover", value)
});

/** Logo 自定义：图片地址（空 = 内置资源）/ 标题文字显隐 / 图片填充方式 */
const logoSource = computed({
  get: () => $storage?.configure?.logoSource ?? "",
  set: value => storageConfigureChange("logoSource", String(value ?? "").trim())
});
const logoShowText = computed({
  get: () => $storage?.configure?.logoShowText ?? true,
  set: value => storageConfigureChange("logoShowText", value)
});
const logoFit = computed({
  get: () => $storage?.configure?.logoFit ?? "contain",
  set: value => storageConfigureChange("logoFit", value)
});

/** 折叠宽度 / 混合布局宽度：写入内联 CSS 变量（见 usePreferenceAttributes） */
const sidebarCollapseWidth = computed<number>({
  get: () =>
    $storage?.configure?.sidebarCollapseWidth ?? DEFAULT_SIDEBAR_COLLAPSE_WIDTH,
  set: value =>
    storageConfigureChange(
      "sidebarCollapseWidth",
      normalizeSidebarCollapseWidth(value)
    )
});
const sidebarMixedWidth = computed<number>({
  get: () => normalizeSidebarMixedWidth($storage?.configure?.sidebarMixedWidth),
  set: value =>
    storageConfigureChange(
      "sidebarMixedWidth",
      normalizeSidebarMixedWidth(value)
    )
});

/** 隐藏侧栏（内容区最大化）/ 钉住按钮 / 混合布局额外收起 */
const sidebarHidden = computed({
  get: () => $storage?.configure?.sidebarHidden ?? false,
  set: value => storageConfigureChange("sidebarHidden", value)
});
const sidebarFixedButton = computed({
  get: () => $storage?.configure?.sidebarFixedButton ?? false,
  set: value => storageConfigureChange("sidebarFixedButton", value)
});
const sidebarExtraCollapse = computed({
  get: () => $storage?.configure?.sidebarExtraCollapse ?? false,
  set: value => storageConfigureChange("sidebarExtraCollapse", value)
});

const logoFitOptions = computed(() => [
  { value: "contain", label: t("layout.logoFitContain") },
  { value: "cover", label: t("layout.logoFitCover") },
  { value: "fill", label: t("layout.logoFitFill") },
  { value: "none", label: t("layout.logoFitNone") },
  { value: "scale-down", label: t("layout.logoFitScaleDown") }
]);

/** 侧栏右缘拖拽调宽把手（松开时保存宽度） */
const sidebarDraggable = computed({
  get: () => $storage?.configure?.sidebarDraggable ?? false,
  set: value => storageConfigureChange("sidebarDraggable", value)
});

/** 折叠态显示菜单标题（图标在上、标题在下，仅垂直布局） */
const sidebarCollapsedShowTitle = computed({
  get: () => $storage?.configure?.sidebarCollapsedShowTitle ?? false,
  set: value => storageConfigureChange("sidebarCollapsedShowTitle", value)
});

/** 点击顶层父级菜单展开时自动激活并跳转第一个子菜单 */
const sidebarAutoActivateChild = computed({
  get: () => $storage?.configure?.sidebarAutoActivateChild ?? false,
  set: value => storageConfigureChange("sidebarAutoActivateChild", value)
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
    <PrefRow :label="t('layout.logoSource')" :tip="t('layout.logoSourceTip')">
      <template #control>
        <el-input
          v-model="logoSource"
          :placeholder="t('layout.logoSourcePlaceholder')"
          size="small"
          clearable
          style="width: 168px"
        />
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.logoShowText')"
      :tip="t('layout.logoShowTextTip')"
    >
      <template #control>
        <el-switch
          v-model="logoShowText"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
    <PrefRow :label="t('layout.logoFit')" :tip="t('layout.logoFitTip')">
      <template #control>
        <el-select v-model="logoFit" size="small" style="width: 128px">
          <el-option
            v-for="item in logoFitOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
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
      :label="t('layout.semiDarkSidebarSub')"
      :tip="t('layout.semiDarkSidebarSubTip')"
      :disabled="isDark || !isMixLayout"
    >
      <template #control>
        <el-switch
          v-model="semiDarkSidebarSub"
          :active-text="t('labels.active')"
          :disabled="isDark || !isMixLayout"
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
    <PrefRow
      :label="t('layout.sidebarCollapseWidth')"
      :tip="t('layout.sidebarCollapseWidthTip')"
    >
      <template #control>
        <el-input-number
          v-model="sidebarCollapseWidth"
          :min="SIDEBAR_COLLAPSE_WIDTH_RANGE.min"
          :max="SIDEBAR_COLLAPSE_WIDTH_RANGE.max"
          :step="2"
          size="small"
          controls-position="right"
          style="width: 108px"
        />
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.sidebarMixedWidth')"
      :tip="t('layout.sidebarMixedWidthTip')"
    >
      <template #control>
        <el-input-number
          v-model="sidebarMixedWidth"
          :min="SIDEBAR_MIXED_WIDTH_RANGE.min"
          :max="SIDEBAR_MIXED_WIDTH_RANGE.max"
          :step="10"
          size="small"
          controls-position="right"
          style="width: 108px"
        />
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.sidebarFixedButton')"
      :tip="t('layout.sidebarFixedButtonTip')"
    >
      <template #control>
        <el-switch
          v-model="sidebarFixedButton"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.sidebarExtraCollapse')"
      :tip="t('layout.sidebarExtraCollapseTip')"
      :disabled="!isMixLayout"
    >
      <template #control>
        <el-switch
          v-model="sidebarExtraCollapse"
          :active-text="t('labels.active')"
          :disabled="!isMixLayout"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.sidebarHidden')"
      :tip="t('layout.sidebarHiddenTip')"
    >
      <template #control>
        <el-switch
          v-model="sidebarHidden"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.sidebarExpandOnHover')"
      :tip="t('layout.sidebarExpandOnHoverTip')"
    >
      <template #control>
        <el-switch
          v-model="sidebarExpandOnHover"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.sidebarDraggable')"
      :tip="t('layout.sidebarDraggableTip')"
    >
      <template #control>
        <el-switch
          v-model="sidebarDraggable"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.sidebarCollapsedShowTitle')"
      :tip="t('layout.sidebarCollapsedShowTitleTip')"
    >
      <template #control>
        <el-switch
          v-model="sidebarCollapsedShowTitle"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.sidebarAutoActivateChild')"
      :tip="t('layout.sidebarAutoActivateChildTip')"
    >
      <template #control>
        <el-switch
          v-model="sidebarAutoActivateChild"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
  </PrefBlock>
</template>
