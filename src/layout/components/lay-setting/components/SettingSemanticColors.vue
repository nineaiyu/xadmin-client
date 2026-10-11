<script lang="ts" setup>
// 外观 - 功能色（语义色）：成功 / 警告 / 危险三色可自定义。
// 取色写入 `tokens/primitives` 的 --success / --warning / --danger 令牌（空串 = 内置默认），
// EP 的 --el-color-* 与色阶由 ep-bridge 派生（见 tokens/ep-bridge.scss）。
import { useGlobal } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import { SEMANTIC_COLOR_FIELDS } from "@/utils/themeConstants";
import type { SemanticColorKey } from "@/utils/themeConstants";
import { useConfigureStorage } from "../hooks/useConfigureStorage";
import PrefBlock from "./PrefBlock.vue";
import PrefRow from "./PrefRow.vue";

import Brush from "~icons/ep/brush";
import RefreshLine from "~icons/ri/refresh-line";

const { t } = useNav();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { storageConfigureChange } = useConfigureStorage();

/** 当前生效色值：未自定义时展示内置默认（取色器起点） */
const colorOf = (item: (typeof SEMANTIC_COLOR_FIELDS)[number]) =>
  ($storage?.configure?.[item.key] as string | undefined) || item.defaultColor;

const isCustomized = (key: SemanticColorKey) =>
  Boolean($storage?.configure?.[key]);

function onColorInput(key: SemanticColorKey, event: Event) {
  const { value } = event.target as HTMLInputElement;
  if (!/^#[0-9a-f]{6}$/i.test(value)) return;
  storageConfigureChange(key, value);
}

function resetColor(key: SemanticColorKey) {
  storageConfigureChange(key, "");
}
</script>

<template>
  <PrefBlock
    :title="t('layout.semanticColors')"
    :desc="t('layout.semanticColorsDesc')"
    :icon="Brush"
    list
    flush
  >
    <PrefRow
      v-for="item in SEMANTIC_COLOR_FIELDS"
      :key="item.key"
      :label="t(item.labelKey)"
      :tip="t('layout.semanticColorsTip')"
    >
      <template #control>
        <div class="semantic-color">
          <label
            class="semantic-color__swatch"
            :style="{ background: colorOf(item) }"
            :title="t('layout.semanticColorsPick')"
          >
            <input
              type="color"
              class="semantic-color__picker"
              :value="colorOf(item)"
              :aria-label="t(item.labelKey)"
              @input="onColorInput(item.key, $event)"
            />
          </label>
          <span class="semantic-color__value">{{ colorOf(item) }}</span>
          <el-button
            v-if="isCustomized(item.key)"
            link
            type="primary"
            size="small"
            class="semantic-color__reset"
            :title="t('layout.semanticColorsReset')"
            :aria-label="t('layout.semanticColorsReset')"
            @click="resetColor(item.key)"
          >
            <IconifyIconOffline :icon="RefreshLine" />
          </el-button>
        </div>
      </template>
    </PrefRow>
  </PrefBlock>
</template>

<style lang="scss" scoped>
.semantic-color {
  display: flex;
  gap: 8px;
  align-items: center;

  &__swatch {
    position: relative;
    display: inline-flex;
    width: 18px;
    height: 18px;
    cursor: pointer;
    border-radius: var(--radius-sm);
    box-shadow: hsl(var(--fg) / 15%) 0 0 0 1px inset;
  }

  /* 原生取色器铺满色块（不可见但可点、可聚焦） */
  &__picker {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 0;
    cursor: pointer;
    background: transparent;
    border: 0;
    opacity: 0;
  }

  &__value {
    min-width: 62px;
    font-family: var(--font-family-mono);
    font-size: var(--font-size-xs);
    color: var(--el-text-color-secondary);
  }

  &__reset {
    padding: 0;
    font-size: var(--font-size-sm);
  }
}
</style>
