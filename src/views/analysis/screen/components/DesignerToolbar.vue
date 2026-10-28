<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import type {
  ScreenChoiceValue,
  ScreenLayoutMode
} from "@/api/dataset/analysis";
import type { ScreenTheme } from "../utils/screenTheme";
import DesignerThemePicker from "./DesignerThemePicker.vue";

defineOptions({ name: "ScreenDesignerToolbar" });

/**
 * 大屏设计器顶部工具条（自 designer 抽出，行数门禁）：
 * 标题 / 未保存与只读标记 / 布局模式切换（栅格 ↔ 自由，只写 layout_mode，
 * 另一模式载荷原样保留）/ 撤销重做 / 复制 / 刷新数据 / 预览 / 清空 / 保存。
 */
const props = defineProps<{
  screenName?: string;
  dirty: boolean;
  readonly: boolean;
  preview: boolean;
  saving: boolean;
  mode: ScreenLayoutMode;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  panesEmpty: boolean;
  theme?: ScreenChoiceValue;
  themeColor?: string;
}>();

const emit = defineEmits<{
  mode: [mode: ScreenLayoutMode];
  theme: [patch: { theme?: ScreenTheme; theme_color?: string }];
  undo: [];
  redo: [];
  duplicate: [];
  refresh: [];
  preview: [];
  clear: [];
  versions: [];
  back: [];
  save: [];
}>();

const { t } = useI18n();

/** 预览与只读同锁：编辑入口（含模式切换）一概不响应 */
const locked = () => props.preview || props.readonly;
</script>

<template>
  <header class="designer-header">
    <span class="designer-title">
      {{ t("dataScreen.designer") }}
      <span class="designer-subtitle">· {{ screenName }}</span>
    </span>
    <el-tag v-if="dirty" size="small" type="warning" effect="dark">
      {{ t("dataScreen.unsaved") }}
    </el-tag>
    <el-tag
      v-if="readonly"
      size="small"
      type="info"
      effect="plain"
      data-testid="designer-readonly"
    >
      {{ t("dataScreen.readonlyHint") }}
    </el-tag>

    <el-radio-group
      class="designer-mode"
      :model-value="mode"
      size="small"
      :disabled="locked()"
      data-testid="designer-mode"
      @change="emit('mode', $event as ScreenLayoutMode)"
    >
      <el-radio-button value="grid" data-testid="designer-mode-grid">
        {{ t("dataScreen.modeGrid") }}
      </el-radio-button>
      <el-radio-button value="free" data-testid="designer-mode-free">
        {{ t("dataScreen.modeFree") }}
      </el-radio-button>
    </el-radio-group>

    <DesignerThemePicker
      :theme="theme"
      :theme-color="themeColor"
      :disabled="locked()"
      @change="emit('theme', $event)"
    />

    <div class="flex-1" />
    <el-button
      size="small"
      data-testid="designer-undo"
      :disabled="!canUndo || locked()"
      :title="t('dataScreen.undoHint')"
      @click="emit('undo')"
    >
      {{ t("dataScreen.undo") }}
    </el-button>
    <el-button
      size="small"
      data-testid="designer-redo"
      :disabled="!canRedo || locked()"
      :title="t('dataScreen.redoHint')"
      @click="emit('redo')"
    >
      {{ t("dataScreen.redo") }}
    </el-button>
    <el-button
      size="small"
      data-testid="designer-duplicate"
      :disabled="!hasSelection || locked()"
      :title="t('dataScreen.duplicateHint')"
      @click="emit('duplicate')"
    >
      {{ t("dataScreen.duplicate") }}
    </el-button>
    <el-button
      size="small"
      data-testid="designer-refresh"
      @click="emit('refresh')"
    >
      {{ t("dataScreen.refreshData") }}
    </el-button>
    <el-button
      size="small"
      data-testid="designer-preview"
      @click="emit('preview')"
    >
      {{ preview ? t("dataScreen.editMode") : t("dataScreen.preview") }}
    </el-button>
    <el-button
      size="small"
      data-testid="designer-clear"
      :disabled="panesEmpty || locked()"
      @click="emit('clear')"
    >
      {{ t("dataScreen.clearLayout") }}
    </el-button>
    <el-button
      v-if="!readonly"
      size="small"
      data-testid="designer-versions"
      @click="emit('versions')"
    >
      {{ t("dataScreen.versionHistory") }}
    </el-button>
    <el-button size="small" @click="emit('back')">
      {{ t("dataScreen.backToList") }}
    </el-button>
    <el-button
      type="primary"
      size="small"
      :loading="saving"
      :disabled="readonly"
      :title="readonly ? t('dataScreen.readonlyHint') : undefined"
      data-testid="designer-save"
      @click="emit('save')"
    >
      {{ t("dataScreen.save") }}
    </el-button>
  </header>
</template>

<style lang="scss" scoped>
.designer-header {
  display: flex;
  flex: none;
  gap: var(--space-2);
  align-items: center;
  padding: var(--space-3) var(--space-5);
  background: var(--screen-surface);
  border-bottom: 1px solid var(--screen-border);
}

.designer-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.designer-subtitle {
  font-size: var(--el-font-size-base);
  font-weight: 400;
  color: var(--screen-fg-subtle);
}

.designer-mode {
  margin-left: var(--space-3);
}
</style>
