<script lang="ts" setup>
// 品牌位设置（侧栏 / 顶栏 Logo 共用同一套取值口径）：站点级外观配置——
// 全局生效、仅超管可改（非超管只读并给出提示，见 useSiteWideEdit）。
// 以多根片段输出 PrefRow：li 仍是父级 PrefBlock 的 ul 子元素，视觉分组不变。
import { computed } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import {
  DEFAULT_FULL_LOGO_HEIGHT,
  FULL_LOGO_HEIGHT_RANGE,
  normalizeFullLogoHeight,
  resolveLogoMode
} from "@/layout/hooks/logoPreferences";
import { useConfigureStorage } from "../hooks/useConfigureStorage";
import { useSiteWideEdit } from "../hooks/useSiteWideEdit";
import PrefRow from "./PrefRow.vue";
import PrefChoice from "./PrefChoice.vue";
import type { PrefChoiceOption } from "./prefTypes";

const { t } = useNav();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { storageConfigureChange } = useConfigureStorage();
const { siteWideEditable } = useSiteWideEdit();

/** 站点级 Logo 行提示：只读时替换为「仅管理员可修改」 */
const logoTip = (tipKey: string) =>
  siteWideEditable.value ? t(tipKey) : t("layout.siteWideAdminOnly");

/**
 * 侧栏 Logo 图片显隐：与「Logo 文字」两个开关正交——只关图片时标题仍在，
 * 两者都关时品牌位整体收起。走响应式 `$storage.configure`（跨组件天然同步）。
 */
const showLogo = computed({
  get: () => $storage?.configure?.showLogo ?? true,
  set: value => storageConfigureChange("showLogo", value)
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

/** Logo 形态：图标（图标 + 标题文字）/ 整图（图片含文字，按整图高度渲染） */
const logoMode = computed<"icon" | "full">({
  get: () => resolveLogoMode($storage?.configure),
  set: value => storageConfigureChange("logoMode", value)
});
const logoModeOptions = computed<PrefChoiceOption[]>(() => [
  { value: "icon", label: t("layout.logoModeIcon") },
  { value: "full", label: t("layout.logoModeFull") }
]);
/** 整图高度（px）：仅整图形态生效 */
const fullLogoHeight = computed<number>({
  get: () => $storage?.configure?.fullLogoHeight ?? DEFAULT_FULL_LOGO_HEIGHT,
  set: value =>
    storageConfigureChange("fullLogoHeight", normalizeFullLogoHeight(value))
});
/** 暗色外观专用图（空 = 与浅色共用） */
const logoSourceDark = computed({
  get: () => $storage?.configure?.logoSourceDark ?? "",
  set: value =>
    storageConfigureChange("logoSourceDark", String(value ?? "").trim())
});
const logoFitOptions = computed(() => [
  { value: "contain", label: t("layout.logoFitContain") },
  { value: "cover", label: t("layout.logoFitCover") },
  { value: "fill", label: t("layout.logoFitFill") },
  { value: "none", label: t("layout.logoFitNone") },
  { value: "scale-down", label: t("layout.logoFitScaleDown") }
]);
</script>

<template>
  <PrefRow
    :label="t('layout.sidebarLogo')"
    :tip="logoTip('layout.sidebarLogoTip')"
    :disabled="!siteWideEditable"
  >
    <template #control>
      <el-switch
        v-model="showLogo"
        :active-text="t('labels.active')"
        :active-value="true"
        :disabled="!siteWideEditable"
        :inactive-text="t('labels.inactive')"
        :inactive-value="false"
        inline-prompt
      />
    </template>
  </PrefRow>
  <PrefRow
    :label="t('layout.logoSource')"
    :tip="logoTip('layout.logoSourceTip')"
    :disabled="!siteWideEditable"
  >
    <template #control>
      <el-input
        v-model="logoSource"
        :placeholder="t('layout.logoSourcePlaceholder')"
        :disabled="!siteWideEditable"
        size="small"
        clearable
        style="width: 168px"
      />
    </template>
  </PrefRow>
  <PrefRow
    :label="t('layout.logoShowText')"
    :tip="logoTip('layout.logoShowTextTip')"
    :disabled="!siteWideEditable"
  >
    <template #control>
      <el-switch
        v-model="logoShowText"
        :active-text="t('labels.active')"
        :disabled="!siteWideEditable"
        :inactive-text="t('labels.inactive')"
        inline-prompt
      />
    </template>
  </PrefRow>
  <PrefRow
    :label="t('layout.logoFit')"
    :tip="logoTip('layout.logoFitTip')"
    :disabled="!siteWideEditable"
  >
    <template #control>
      <el-select
        v-model="logoFit"
        :disabled="!siteWideEditable"
        size="small"
        style="width: 128px"
      >
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
    :label="t('layout.logoMode')"
    :tip="logoTip('layout.logoModeTip')"
    :disabled="!siteWideEditable"
    stack
  >
    <template #control>
      <PrefChoice
        :options="logoModeOptions"
        :model-value="logoMode"
        :disabled="!siteWideEditable"
        @change="value => (logoMode = value === 'full' ? 'full' : 'icon')"
      />
    </template>
  </PrefRow>
  <PrefRow
    :label="t('layout.fullLogoHeight')"
    :tip="logoTip('layout.fullLogoHeightTip')"
    :disabled="logoMode !== 'full' || !siteWideEditable"
  >
    <template #control>
      <el-input-number
        v-model="fullLogoHeight"
        :min="FULL_LOGO_HEIGHT_RANGE.min"
        :max="FULL_LOGO_HEIGHT_RANGE.max"
        :step="FULL_LOGO_HEIGHT_RANGE.step"
        :disabled="logoMode !== 'full' || !siteWideEditable"
        size="small"
        controls-position="right"
        style="width: 108px"
      />
    </template>
  </PrefRow>
  <PrefRow
    :label="t('layout.logoSourceDark')"
    :tip="logoTip('layout.logoSourceDarkTip')"
    :disabled="!siteWideEditable"
  >
    <template #control>
      <el-input
        v-model="logoSourceDark"
        :placeholder="t('layout.logoSourcePlaceholder')"
        :disabled="!siteWideEditable"
        size="small"
        clearable
        style="width: 168px"
      />
    </template>
  </PrefRow>
</template>
