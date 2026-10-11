<script lang="ts" setup>
// 外观 - 主题预设：一套预设 = 一套中性表面色系（背景 / 卡片 / 描边 / 填充的色相倾向）
// + 一支配套主色。选中即写偏好（落 `html[data-theme-preset]`）并应用配套主色；
// 「默认」「自定义」不写属性，表面回到内置取值（主色交给「主题色」色卡 / 取色器）。
import { computed } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";
import {
  CUSTOM_THEME_PRESET,
  DEFAULT_THEME_PRESET,
  themePresets
} from "@/layout/hooks/themePresets";
import { useConfigureStorage } from "../hooks/useConfigureStorage";
import PrefBlock from "./PrefBlock.vue";

import Check from "~icons/ep/check";
import ColorFilterLine from "~icons/ri/color-filter-line";
import PaletteLine from "~icons/ri/palette-line";

const { t } = useNav();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { storageConfigureChange } = useConfigureStorage();
const { applyThemePreset } = useDataThemeChange();

const currentPreset = computed(
  () => $storage?.configure?.themePreset ?? DEFAULT_THEME_PRESET
);

function selectPreset(type: string) {
  if (type === currentPreset.value) return;
  storageConfigureChange("themePreset", type);
  applyThemePreset(type);
}
</script>

<template>
  <PrefBlock
    :title="t('layout.themePreset')"
    :desc="t('layout.themePresetDesc')"
    :icon="ColorFilterLine"
  >
    <ul class="theme-preset">
      <li
        v-for="item in themePresets"
        :key="item.type"
        class="theme-preset__item"
        :class="{ 'is-active': currentPreset === item.type }"
        :title="t(item.labelKey)"
        @click="selectPreset(item.type)"
      >
        <span class="theme-preset__box">
          <span
            class="theme-preset__swatch"
            :style="{ background: item.swatch }"
          >
            <el-icon
              v-if="currentPreset === item.type"
              color="var(--el-color-white)"
              :size="14"
              class="theme-preset__check"
            >
              <IconifyIconOffline :icon="Check" />
            </el-icon>
          </span>
        </span>
        <span class="theme-preset__name">{{ t(item.labelKey) }}</span>
      </li>
      <!-- 自定义：不清主色，只把表面色系交还给内置取值 -->
      <li
        class="theme-preset__item theme-preset__custom"
        :class="{ 'is-active': currentPreset === CUSTOM_THEME_PRESET }"
        :title="t('layout.themePresetNames.custom')"
        @click="selectPreset(CUSTOM_THEME_PRESET)"
      >
        <span class="theme-preset__box">
          <span class="theme-preset__swatch theme-preset__swatch--custom">
            <el-icon
              v-if="currentPreset === CUSTOM_THEME_PRESET"
              color="var(--el-color-white)"
              :size="14"
              class="theme-preset__check"
            >
              <IconifyIconOffline :icon="Check" />
            </el-icon>
            <IconifyIconOffline v-else :icon="PaletteLine" />
          </span>
        </span>
        <span class="theme-preset__name">
          {{ t("layout.themePresetNames.custom") }}
        </span>
      </li>
    </ul>
  </PrefBlock>
</template>

<style lang="scss" scoped>
/* 与「主题色」色卡同形制（外框预览盒 + 居中色块 + 名称标签），
   选中以外框主色描边 + 浅底标记 */
.theme-preset {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px 6px;
  margin-top: 6px;

  &__item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: center;
    cursor: pointer;
  }

  &__box {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 34px;
    border: 1px solid var(--el-border-color);
    border-radius: var(--radius-md);
    transition:
      background-color var(--duration-fast) var(--ease-standard),
      border-color var(--duration-fast) var(--ease-standard);
  }

  &__item:hover &__box {
    border-color: var(--el-border-color-darker);
  }

  &__item.is-active &__box {
    background: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary);
  }

  &__swatch {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: var(--radius-full);
    box-shadow: hsl(var(--fg) / 15%) 0 0 0 1px inset;
  }

  &__check {
    pointer-events: none;
    filter: drop-shadow(0 0 1px hsl(var(--fg) / 45%));
  }

  &__custom &__swatch {
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color);
    transition: color var(--duration-fast) var(--ease-standard);
  }

  &__custom:not(.is-active):hover &__swatch {
    color: var(--el-color-primary);
  }

  &__name {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: var(--font-size-xs);
    line-height: 1.2;
    color: var(--el-text-color-regular);
    white-space: nowrap;
    transition: color var(--duration-fast) var(--ease-standard);
  }

  &__item.is-active &__name {
    font-weight: 600;
    color: var(--el-color-primary);
  }
}
</style>
