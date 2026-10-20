<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { themeColors } from "@/layout/hooks/themeColorScheme";
import type { ScreenTheme } from "../utils/screenTheme";
import BrushIcon from "~icons/ep/brush";

defineOptions({ name: "ScreenDisplayThemePanel" });

/**
 * 投屏页头部的「主题」面板（popover 内容）。
 *
 * 切换只作用于本机（现场临时看浅色/深色），需要固化时点「保存为默认」——
 * 是否显示该按钮由 `canSave` 决定（无编辑权限的展示端只做本机预览）。
 * 主题色为空 = 跟随站点主色（与设计器同一口径）。
 */
const props = defineProps<{
  theme: ScreenTheme;
  themeColor: string;
  canSave?: boolean;
  saving?: boolean;
  overridden?: boolean;
}>();

const emit = defineEmits<{
  change: [{ theme?: ScreenTheme; theme_color?: string }];
  save: [];
  reset: [];
}>();

const { t } = useI18n();

/** 站点设置面板同款色卡（导航皮肤色值即主色预设） */
const presets = computed(() => themeColors.value.map(item => item.color));

const options = computed<Array<{ value: ScreenTheme; label: string }>>(() => [
  { value: "dark", label: t("dataScreen.themeDark") },
  { value: "light", label: t("dataScreen.themeLight") },
  { value: "auto", label: t("dataScreen.themeAuto") }
]);

const onTheme = (next: string | number | boolean | undefined) =>
  emit("change", { theme: next as ScreenTheme });

const onColor = (next: string | null) =>
  emit("change", { theme_color: next ?? "" });
</script>

<template>
  <el-popover placement="bottom-end" :width="272" trigger="click">
    <template #reference>
      <el-button
        size="small"
        :icon="BrushIcon"
        :aria-label="t('dataScreen.theme')"
        :title="t('dataScreen.theme')"
        data-testid="screen-theme-trigger"
      />
    </template>
    <div class="screen-theme-panel">
      <div class="screen-theme-panel__hint">
        {{ t("dataScreen.themeLocalHint") }}
      </div>
      <el-radio-group
        size="small"
        :model-value="props.theme"
        data-testid="screen-theme-options"
        @change="onTheme"
      >
        <el-radio-button
          v-for="item in options"
          :key="item.value"
          :value="item.value"
          :data-testid="`screen-theme-${item.value}`"
        >
          {{ item.label }}
        </el-radio-button>
      </el-radio-group>
      <div class="screen-theme-panel__row">
        <span class="screen-theme-panel__label">
          {{ t("dataScreen.themeColor") }}
        </span>
        <el-color-picker
          size="small"
          :model-value="themeColor || null"
          :predefine="presets"
          @change="onColor"
        />
        <el-button v-if="themeColor" link size="small" @click="onColor(null)">
          {{ t("dataScreen.themeColorFollow") }}
        </el-button>
      </div>
      <div class="screen-theme-panel__actions">
        <el-button
          v-if="overridden"
          link
          size="small"
          data-testid="screen-theme-reset"
          @click="emit('reset')"
        >
          {{ t("dataScreen.themeReset") }}
        </el-button>
        <el-button
          v-if="canSave"
          size="small"
          type="primary"
          :loading="saving"
          data-testid="screen-theme-save"
          @click="emit('save')"
        >
          {{ t("dataScreen.themeSaveAsDefault") }}
        </el-button>
      </div>
    </div>
  </el-popover>
</template>

<style lang="scss" scoped>
.screen-theme-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.screen-theme-panel__hint {
  font-size: var(--el-font-size-extra-small);
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.screen-theme-panel__row {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.screen-theme-panel__label {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-regular);
}

.screen-theme-panel__actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: flex-end;
}
</style>
