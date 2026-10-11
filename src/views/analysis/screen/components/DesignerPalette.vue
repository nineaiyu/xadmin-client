<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import type { ScreenPaneType } from "@/api/dataset/analysis";
import type { DashboardItem } from "@/api/dataset/datasets";

defineOptions({ name: "DesignerPalette" });

/**
 * 设计器左侧组件库：指标卡 / 图片 / 文本 / 时钟 / 仪表盘清单。
 * 点击即新增；条目可拖入画布指定落格（payload 口径见 utils/dnd.ts）。
 */
defineProps<{ dashboards: DashboardItem[] }>();

const emit = defineEmits<{
  add: [type: ScreenPaneType, dashboard?: string];
  dragStart: [event: DragEvent, type: ScreenPaneType, dashboard?: string];
}>();

const { t } = useI18n();
</script>

<template>
  <aside class="designer-palette">
    <div class="designer-palette__title">{{ t("dataScreen.palette") }}</div>
    <el-button
      class="w-full"
      draggable="true"
      data-testid="palette-metric"
      @click="emit('add', 'metric')"
      @dragstart="emit('dragStart', $event, 'metric')"
    >
      {{ t("dataScreen.paneMetric") }}
    </el-button>
    <el-button
      class="w-full"
      draggable="true"
      data-testid="palette-image"
      @click="emit('add', 'image')"
      @dragstart="emit('dragStart', $event, 'image')"
    >
      {{ t("dataScreen.paneImage") }}
    </el-button>
    <el-button
      class="w-full"
      draggable="true"
      data-testid="palette-text"
      @click="emit('add', 'text')"
      @dragstart="emit('dragStart', $event, 'text')"
    >
      {{ t("dataScreen.paneText") }}
    </el-button>
    <el-button
      class="w-full"
      draggable="true"
      data-testid="palette-clock"
      @click="emit('add', 'clock')"
      @dragstart="emit('dragStart', $event, 'clock')"
    >
      {{ t("dataScreen.paneClock") }}
    </el-button>
    <el-divider />
    <div class="designer-palette__title">
      {{ t("dataScreen.paneDashboard") }}
    </div>
    <div class="designer-palette__list">
      <el-button
        v-for="item in dashboards"
        :key="item.pk"
        class="w-full"
        draggable="true"
        data-testid="palette-dashboard"
        @click="emit('add', 'dashboard', item.pk)"
        @dragstart="emit('dragStart', $event, 'dashboard', item.pk)"
      >
        {{ item.name }}
      </el-button>
      <span v-if="dashboards.length === 0" class="designer-hint">
        {{ t("dataScreen.noDashboards") }}
      </span>
    </div>
    <el-divider />
    <div class="designer-hint">{{ t("dataScreen.shortcutsHint") }}</div>
  </aside>
</template>

<style lang="scss" scoped>
.designer-palette {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--space-2);
  width: 220px;
  padding: var(--space-3);
  overflow: auto;
  background: var(--screen-surface);
  border-right: 1px solid var(--screen-border);

  /* EP 的 `.el-button + .el-button { margin-left: 12px }` 是横向按钮组语义，
     纵向组件库里会把第 2 个起的按钮整体顶右 12px（含仪表盘清单），统一清零 */
  :deep(.el-button + .el-button) {
    margin-left: 0;
  }
}

.designer-palette__title {
  font-size: var(--el-font-size-small);
  color: var(--screen-fg-muted);
}

.designer-palette__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-height: 40vh;
  overflow: auto;
}

.designer-hint {
  font-size: var(--el-font-size-extra-small);
  line-height: 1.6;
  color: var(--screen-fg-dim);
}
</style>
