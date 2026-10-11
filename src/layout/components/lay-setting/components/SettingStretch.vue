<script lang="ts" setup>
// 系统设置面板：页宽（流式 / 定宽 + 宽度滑块）设置区块。
// `stretch` 语义：false = 占满可用宽度，number = 内容区最大宽度（px）
import { computed } from "vue";
import { isNumber, useGlobal } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import { useAppStoreHook } from "@/store/modules/app";
import { BREAKPOINTS } from "@/utils/breakpoints";
import { useConfigureStorage } from "../hooks/useConfigureStorage";
import PrefBlock from "./PrefBlock.vue";
import PrefRow from "./PrefRow.vue";
import PrefChoice from "./PrefChoice.vue";
import type { PrefChoiceOption } from "./prefTypes";

import WidthLine from "~icons/ri/expand-horizontal-line";

const { t } = useNav();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { storageConfigureChange } = useConfigureStorage();

/** 定宽档的默认宽度（与既有实现的缺省值一致） */
const DEFAULT_STRETCH_WIDTH = 1440;
const STRETCH_WIDTH_RANGE = { min: 1280, max: 1600, step: 20 };

const options = computed<PrefChoiceOption[]>(() => [
  {
    value: "fluid",
    label: t("layout.fluid"),
    tip: t("layout.fluidTip")
  },
  {
    value: "fixed",
    label: t("layout.fixedWidth"),
    tip: t("layout.fixedWidthTip")
  }
]);

const current = computed(() =>
  isNumber($storage?.configure?.stretch) ? "fixed" : "fluid"
);

/** 定宽值：写回 number（流式档为 false，由卡片切换负责） */
const stretchWidth = computed<number>({
  get: () =>
    isNumber($storage?.configure?.stretch)
      ? ($storage?.configure?.stretch as number)
      : DEFAULT_STRETCH_WIDTH,
  set: value => storageConfigureChange("stretch", value)
});

function onChoiceChange(value: string) {
  storageConfigureChange(
    "stretch",
    value === "fixed" ? DEFAULT_STRETCH_WIDTH : false
  );
}
</script>

<template>
  <PrefBlock
    v-if="useAppStoreHook().getViewportWidth > BREAKPOINTS.xl"
    :title="t('layout.pageWidth')"
    :icon="WidthLine"
    list
    flush
  >
    <PrefRow :label="t('layout.pageWidthMode')" stack>
      <template #control>
        <PrefChoice
          :options="options"
          :model-value="current"
          @change="onChoiceChange"
        />
      </template>
    </PrefRow>
    <PrefRow v-if="current === 'fixed'" :label="t('layout.pageWidthSize')">
      <template #control>
        <span class="pref-stretch__value">{{ stretchWidth }}px</span>
        <el-slider
          v-model="stretchWidth"
          :min="STRETCH_WIDTH_RANGE.min"
          :max="STRETCH_WIDTH_RANGE.max"
          :step="STRETCH_WIDTH_RANGE.step"
          class="pref-stretch__slider"
          :show-tooltip="false"
        />
      </template>
    </PrefRow>
  </PrefBlock>
</template>

<style lang="scss" scoped>
@use "@/style/tokens/breakpoints" as bp;

.pref-stretch__slider {
  width: 132px;
}

.pref-stretch__value {
  min-width: 52px;
  font-size: var(--font-size-xs);
  color: var(--el-text-color-secondary);
  text-align: right;
}

@include bp.below("md") {
  .pref-stretch__slider {
    width: 100%;
  }
}
</style>
