<script lang="ts" setup>
// 系统设置面板「外观」：尺度档位（圆角 / 字号），实时生效并落站点配置。
// 两档位只缩放设计令牌（--radius-* / --font-size-*），不动 html 根字号——
// 根字号会连带缩放 Tailwind 的间距与控件高度（见 tokens/primitives.scss 末尾）。
// 字号在「小 / 默认 / 大」三档之外提供自定义连续档（12~20px，等价倍率写 --font-scale）。
import { computed } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import {
  FONT_BASE_PX,
  FONT_SIZE_RANGE,
  normalizeFontBasePx
} from "@/layout/hooks/usePreferenceAttributes";
import { useConfigureStorage } from "../hooks/useConfigureStorage";
import PrefBlock from "./PrefBlock.vue";
import PrefRow from "./PrefRow.vue";

import RadiusLine from "~icons/ri/rounded-corner";
import FontLine from "~icons/ri/font-size-2";

const { t } = useNav();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { storageConfigureChange } = useConfigureStorage();

const radiusOptions = computed(() => [
  { label: t("layout.radiusNone"), value: "none" },
  { label: t("layout.radiusSmall"), value: "small" },
  { label: t("layout.radiusDefault"), value: "default" },
  { label: t("layout.radiusLarge"), value: "large" },
  { label: t("layout.radiusXlarge"), value: "xlarge" }
]);

const fontOptions = computed(() => [
  { label: t("layout.fontSmall"), value: "small" },
  { label: t("layout.fontDefault"), value: "default" },
  { label: t("layout.fontLarge"), value: "large" },
  { label: t("layout.fontCustom"), value: "custom" }
]);

/** 圆角档位：写入 html[data-radius]（usePreferenceAttributes） */
const radius = computed<RadiusScaleType>({
  get: () => $storage?.configure?.radius ?? "default",
  set: value => storageConfigureChange("radius", value)
});

/** 字号档位：写入 html[data-font]；自定义档另写 --font-scale 倍率 */
const fontSizeScale = computed<FontScaleType>({
  get: () => $storage?.configure?.fontScale ?? "default",
  set: value => storageConfigureChange("fontScale", value)
});

/** 自定义档基准字号（px，12~20，步进 0.5） */
const fontBasePx = computed<number>({
  get: () =>
    normalizeFontBasePx($storage?.configure?.fontScaleCustom ?? FONT_BASE_PX),
  set: value => storageConfigureChange("fontScaleCustom", value)
});
</script>

<template>
  <PrefBlock
    :title="t('layout.radius')"
    :tip="t('layout.radiusTip')"
    :icon="RadiusLine"
  >
    <el-radio-group v-model="radius" size="small">
      <el-radio-button
        v-for="item in radiusOptions"
        :key="item.value"
        :value="item.value"
      >
        {{ item.label }}
      </el-radio-button>
    </el-radio-group>
  </PrefBlock>

  <PrefBlock
    :title="t('layout.fontSize')"
    :tip="t('layout.fontSizeTip')"
    :icon="FontLine"
    list
    flush
  >
    <PrefRow :label="t('layout.fontSizeScale')" stack>
      <template #control>
        <el-radio-group v-model="fontSizeScale" size="small">
          <el-radio-button
            v-for="item in fontOptions"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </el-radio-button>
        </el-radio-group>
      </template>
    </PrefRow>
    <PrefRow
      v-if="fontSizeScale === 'custom'"
      :label="t('layout.fontCustomSize')"
    >
      <template #control>
        <span class="pref-scale__value">{{ fontBasePx }}px</span>
        <el-slider
          v-model="fontBasePx"
          :min="FONT_SIZE_RANGE.min"
          :max="FONT_SIZE_RANGE.max"
          :step="FONT_SIZE_RANGE.step"
          class="pref-scale__slider"
          :show-tooltip="false"
        />
      </template>
    </PrefRow>
  </PrefBlock>
</template>

<style lang="scss" scoped>
@use "@/style/tokens/breakpoints" as bp;

.pref-scale__slider {
  width: 132px;
}

.pref-scale__value {
  min-width: 44px;
  font-size: var(--font-size-xs);
  color: var(--el-text-color-secondary);
  text-align: right;
}

/* 窄屏：滑块占满控件行 */
@include bp.below("md") {
  .pref-scale__slider {
    width: 100%;
  }
}
</style>
