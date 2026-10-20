<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { choiceValue } from "@/utils/dict";
import { themeColors } from "@/layout/hooks/themeColorScheme";
import type { ScreenChoiceValue } from "@/api/dataset/analysis";
import type { ScreenTheme } from "../utils/screenTheme";

defineOptions({ name: "ScreenDesignerThemePicker" });

/**
 * 设计器工具条的「外观」段：主题（深色 / 浅色 / 跟随站点）+ 主题色。
 *
 * 主题是**大屏自身属性**（不是画布操作）：改动即时预览（根节点令牌与图表配色
 * 同步切换）并标脏，不进撤销栈；保存时与画布载荷一起 `partialUpdate`。
 * 主题色为空 = 跟随站点主色；预设色卡与站点设置面板同一组色值。
 */
const props = defineProps<{
  theme?: ScreenChoiceValue;
  themeColor?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  change: [patch: { theme?: ScreenTheme; theme_color?: string }];
}>();

const { t } = useI18n();

/** 站点设置面板同款色卡（导航皮肤色值即主色预设） */
const presets = themeColors.value.map(item => item.color);

const value = computed<ScreenTheme>(
  () => (choiceValue(props.theme) as ScreenTheme) || "dark"
);

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
  <div class="designer-theme" data-testid="designer-theme">
    <span class="designer-theme__label">{{ t("dataScreen.theme") }}</span>
    <el-radio-group
      size="small"
      :model-value="value"
      :disabled="disabled"
      @change="onTheme"
    >
      <el-radio-button
        v-for="item in options"
        :key="item.value"
        :value="item.value"
        :data-testid="`designer-theme-${item.value}`"
      >
        {{ item.label }}
      </el-radio-button>
    </el-radio-group>
    <span class="designer-theme__label">{{ t("dataScreen.themeColor") }}</span>
    <div data-testid="designer-theme-color">
      <el-color-picker
        size="small"
        :model-value="themeColor || null"
        :predefine="presets"
        :disabled="disabled"
        @change="onColor"
      />
    </div>
    <el-button
      v-if="themeColor"
      link
      size="small"
      data-testid="designer-theme-color-clear"
      @click="onColor(null)"
    >
      {{ t("dataScreen.themeColorFollow") }}
    </el-button>
  </div>
</template>

<style lang="scss" scoped>
.designer-theme {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  margin-left: var(--space-3);
}

.designer-theme__label {
  font-size: var(--el-font-size-extra-small);
  color: var(--screen-fg-subtle);
}
</style>
