<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { ScreenLayoutPane, ScreenPaneType } from "@/api/dataset/analysis";
import type { DashboardItem } from "@/api/dataset/datasets";

/**
 * 窗格属性面板（设计器右侧）。
 *
 * 只改数据、不碰画布坐标：位置/尺寸变化由设计器统一走 `canPlace` 校验（重叠即拒绝并提示），
 * 因此这里的 number 输入直接提交，非法值由上层就地驳回（输入框保持用户填的值，便于回改）。
 */
defineOptions({ name: "ScreenPaneInspector" });

const props = defineProps<{
  pane: ScreenLayoutPane;
  dashboards: DashboardItem[];
}>();

const emit = defineEmits<{
  update: [patch: Partial<ScreenLayoutPane>];
}>();

const { t } = useI18n();

const typeLabel = computed(() => {
  const map: Record<ScreenPaneType, string> = {
    dashboard: t("dataScreen.paneDashboard"),
    text: t("dataScreen.paneText"),
    clock: t("dataScreen.paneClock")
  };
  return map[props.pane.type];
});

/** 数字输入：el-input-number 的 v-model 需要可写计算属性（直接 emit 会让中间态丢失） */
const numeric = (key: "x" | "y" | "w" | "h" | "size", fallback = 0) =>
  computed({
    get: () => Number(props.pane[key] ?? fallback),
    set: (value: number) =>
      emit("update", { [key]: value } as Partial<ScreenLayoutPane>)
  });

const x = numeric("x");
const y = numeric("y");
const w = numeric("w");
const h = numeric("h");
const size = numeric("size", 24);
</script>

<template>
  <div class="pane-inspector">
    <div class="pane-inspector__title">
      {{ t("dataScreen.inspector") }}
      <span class="pane-inspector__type">{{ typeLabel }}</span>
    </div>

    <el-form label-width="72px" label-position="left" size="small">
      <el-form-item :label="t('dataScreen.paneTitle')">
        <el-input
          :model-value="pane.title ?? ''"
          data-testid="inspector-title"
          :placeholder="t('dataScreen.paneTitlePlaceholder')"
          @update:model-value="emit('update', { title: $event })"
        />
      </el-form-item>

      <el-form-item
        v-if="pane.type === 'dashboard'"
        :label="t('dataScreen.paneDashboard')"
      >
        <el-select
          :model-value="pane.dashboard"
          class="w-full"
          filterable
          @change="emit('update', { dashboard: $event })"
        >
          <el-option
            v-for="item in dashboards"
            :key="item.pk"
            :value="item.pk"
            :label="item.name"
          />
        </el-select>
      </el-form-item>

      <template v-if="pane.type === 'text'">
        <el-form-item :label="t('dataScreen.paneContent')">
          <el-input
            :model-value="pane.text ?? ''"
            type="textarea"
            :rows="4"
            data-testid="inspector-text"
            @update:model-value="emit('update', { text: $event })"
          />
        </el-form-item>
        <el-form-item :label="t('dataScreen.paneFontSize')">
          <el-input-number v-model="size" :min="14" :max="72" />
        </el-form-item>
        <el-form-item :label="t('dataScreen.paneAlign')">
          <el-radio-group
            :model-value="pane.align ?? 'left'"
            @change="emit('update', { align: $event as 'left' })"
          >
            <el-radio-button value="left">
              {{ t("dataScreen.alignLeft") }}
            </el-radio-button>
            <el-radio-button value="center">
              {{ t("dataScreen.alignCenter") }}
            </el-radio-button>
            <el-radio-button value="right">
              {{ t("dataScreen.alignRight") }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
      </template>

      <el-divider />
      <el-form-item :label="t('dataScreen.panePosition')">
        <div class="pane-inspector__pair">
          <el-input-number
            v-model="x"
            :min="0"
            :max="11"
            controls-position="right"
          />
          <el-input-number
            v-model="y"
            :min="0"
            :max="59"
            controls-position="right"
          />
        </div>
      </el-form-item>
      <el-form-item :label="t('dataScreen.paneSize')">
        <div class="pane-inspector__pair">
          <el-input-number
            v-model="w"
            :min="1"
            :max="12"
            controls-position="right"
          />
          <el-input-number
            v-model="h"
            :min="1"
            :max="60"
            controls-position="right"
          />
        </div>
      </el-form-item>
      <div class="pane-inspector__hint">{{ t("dataScreen.gridHint") }}</div>
    </el-form>
  </div>
</template>

<style lang="scss" scoped>
.pane-inspector__title {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
  font-size: var(--el-font-size-small);
  color: rgb(255 255 255 / 78%);
}

.pane-inspector__type {
  padding: 1px 6px;
  font-size: var(--el-font-size-extra-small);
  color: rgb(255 255 255 / 70%);
  background: rgb(255 255 255 / 8%);
  border-radius: 999px;
}

.pane-inspector__pair {
  display: flex;
  gap: 8px;
  width: 100%;

  :deep(.el-input-number) {
    flex: 1;
    width: auto;
  }
}

.pane-inspector__hint {
  font-size: var(--el-font-size-extra-small);
  line-height: 1.6;
  color: rgb(255 255 255 / 55%);
}

/* 深色画布内的表单：标签与分割线取白色透明度（不随站点主题） */
.pane-inspector :deep(.el-form-item__label) {
  color: rgb(255 255 255 / 70%);
}

.pane-inspector :deep(.el-divider) {
  border-color: rgb(255 255 255 / 12%);
}
</style>
