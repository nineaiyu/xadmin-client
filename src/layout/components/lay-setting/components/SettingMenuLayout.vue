<script lang="ts" setup>
// 系统设置面板：导航模式（垂直/水平/混合）设置区块——预览卡形态（悬停看说明，点选即切换）
import { computed } from "vue";
import { useNav } from "@/layout/hooks/useNav";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";
import { useMenuLayout } from "../hooks/useMenuLayout";
import PrefBlock from "./PrefBlock.vue";
import PrefChoice from "./PrefChoice.vue";
import type { PrefChoiceOption } from "./prefTypes";

import LayoutLine from "~icons/ri/layout-line";

const { device, t } = useNav();
const { layoutTheme } = useDataThemeChange();
const { setMenuLayout } = useMenuLayout();

const options = computed<PrefChoiceOption[]>(() => {
  const list: PrefChoiceOption[] = [
    {
      value: "vertical",
      label: t("layout.menuLayoutVertical"),
      tip: t("layout.leftMode")
    }
  ];
  // 移动端只保留纵向布局（顶栏承载不下横向菜单）
  if (device.value !== "mobile") {
    list.push(
      {
        value: "horizontal",
        label: t("layout.menuLayoutHorizontal"),
        tip: t("layout.topMode")
      },
      {
        value: "mix",
        label: t("layout.menuLayoutMix"),
        tip: t("layout.mixedMode")
      }
    );
  }
  return list;
});

const current = computed(() => layoutTheme.value.layout ?? "vertical");
</script>

<template>
  <PrefBlock :title="t('layout.menuLayout')" :icon="LayoutLine">
    <PrefChoice
      :options="options"
      :model-value="current"
      :preview-height="30"
      @change="value => setMenuLayout(value)"
    >
      <template #preview="{ value }">
        <span class="layout-preview" :class="`layout-preview--${value}`">
          <i class="layout-preview__nav" />
          <i class="layout-preview__head" />
        </span>
      </template>
    </PrefChoice>
  </PrefBlock>
</template>

<style lang="scss" scoped>
.layout-preview {
  position: relative;
  display: block;
  width: 46px;
  height: 30px;
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-sm);

  &__nav,
  &__head {
    position: absolute;
    background: var(--el-text-color-regular);
  }

  /* 垂直：左侧通栏导航 + 顶部条 */
  &--vertical {
    .layout-preview__nav {
      top: 0;
      left: 0;
      width: 30%;
      height: 100%;
    }

    .layout-preview__head {
      top: 0;
      right: 0;
      width: 70%;
      height: 24%;
    }
  }

  /* 水平：仅顶部导航条 */
  &--horizontal {
    .layout-preview__nav {
      top: 0;
      left: 0;
      width: 100%;
      height: 24%;
    }
  }

  /* 混合：顶部导航条 + 左侧次级导航 */
  &--mix {
    .layout-preview__head {
      top: 0;
      left: 0;
      width: 100%;
      height: 24%;
    }

    .layout-preview__nav {
      bottom: 0;
      left: 0;
      width: 30%;
      height: 76%;
    }
  }
}
</style>
