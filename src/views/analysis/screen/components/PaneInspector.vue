<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { ScreenLayoutPane, ScreenPaneType } from "@/api/dataset/analysis";
import type { DashboardItem, DatasetItem } from "@/api/dataset/datasets";
import { isValidPaneImageUrl } from "../utils/layout";

/**
 * 窗格属性面板（设计器右侧）。
 *
 * 只改数据、不碰画布坐标：位置/尺寸变化由设计器统一走 `canPlace` 校验（重叠即拒绝并提示），
 * 因此这里的 number 输入直接提交，非法值由上层就地驳回（输入框保持用户填的值，便于回改）。
 * 指标卡的 sum/avg 取值列限定数据集数值列（与服务端校验同口径，避免保存被 400 打回）。
 */
defineOptions({ name: "ScreenPaneInspector" });

const props = defineProps<{
  pane: ScreenLayoutPane;
  dashboards: DashboardItem[];
  datasets?: DatasetItem[];
}>();

const emit = defineEmits<{
  update: [patch: Partial<ScreenLayoutPane>];
}>();

const { t } = useI18n();

const typeLabel = computed(() => {
  const map: Record<ScreenPaneType, string> = {
    dashboard: t("dataScreen.paneDashboard"),
    text: t("dataScreen.paneText"),
    clock: t("dataScreen.paneClock"),
    metric: t("dataScreen.paneMetric"),
    image: t("dataScreen.paneImage")
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
const clockSize = numeric("size", 40);

/* ---------------- 指标卡窗格 ---------------- */
const datasets = computed(() => props.datasets ?? []);
const metricDataset = computed(
  () => datasets.value.find(item => item.pk === props.pane.dataset) ?? null
);
const metricColumns = computed(() => metricDataset.value?.columns ?? []);
const metricNumeric = computed(() => {
  const numeric = metricDataset.value?.numeric_columns ?? [];
  return numeric.length ? numeric : metricColumns.value;
});
const metricNeedsValue = computed(
  () => (props.pane.metric ?? "count") !== "count"
);

/** 切换指标：sum/avg 需要数值列，缺省补首个数值列；count 清掉取值列 */
const onMetricChange = (metric: "count" | "sum" | "avg") => {
  if (metric === "count") {
    emit("update", { metric, value_field: undefined });
    return;
  }
  const current = props.pane.value_field ?? "";
  emit("update", {
    metric,
    value_field: metricNumeric.value.includes(current)
      ? current
      : (metricNumeric.value[0] ?? "")
  });
};

/** 切换数据集：取值列清空重选（列集合随数据集变化） */
const onMetricDatasetChange = (pk: string) => {
  emit("update", { dataset: pk, value_field: undefined });
};

const onImageFitChange = (fit: "cover" | "contain" | "fill") => {
  emit("update", { fit });
};

/**
 * 图片地址行内校验：口径见 utils/layout 的 isValidPaneImageUrl（http(s) 或
 * 根相对路径，空值 = 尚未配置不报错）；输入过程只提示不阻断，保存时服务端
 * 仍会再校验一次。
 */
const imageUrlError = computed(() =>
  isValidPaneImageUrl(props.pane.url) ? "" : t("dataScreen.imageUrlInvalid")
);
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

      <template v-if="pane.type === 'metric'">
        <el-form-item :label="t('dataScreen.dataset')" required>
          <el-select
            :model-value="pane.dataset"
            class="w-full"
            filterable
            data-testid="inspector-metric-dataset"
            @change="onMetricDatasetChange"
          >
            <el-option
              v-for="item in datasets"
              :key="item.pk"
              :value="item.pk"
              :label="item.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('dataReport.metric')">
          <el-select
            :model-value="pane.metric ?? 'count'"
            class="w-full"
            data-testid="inspector-metric-type"
            @change="onMetricChange($event)"
          >
            <el-option value="count" :label="t('dataReport.metricCount')" />
            <el-option value="sum" :label="t('dataReport.metricSum')" />
            <el-option value="avg" :label="t('dataReport.metricAvg')" />
          </el-select>
        </el-form-item>
        <el-form-item
          v-if="metricNeedsValue"
          :label="t('dataReport.valueField')"
        >
          <el-select
            :model-value="pane.value_field ?? ''"
            class="w-full"
            filterable
            data-testid="inspector-metric-field"
            @change="emit('update', { value_field: $event })"
          >
            <el-option
              v-for="column in metricNumeric"
              :key="column"
              :value="column"
              :label="column"
            />
          </el-select>
        </el-form-item>
      </template>

      <template v-if="pane.type === 'image'">
        <el-form-item
          :label="t('dataScreen.imageUrl')"
          required
          :error="imageUrlError"
        >
          <el-input
            :model-value="pane.url ?? ''"
            placeholder="https://"
            data-testid="inspector-image-url"
            @update:model-value="emit('update', { url: $event })"
          />
        </el-form-item>
        <el-form-item :label="t('dataScreen.imageFit')">
          <el-radio-group
            :model-value="pane.fit ?? 'cover'"
            data-testid="inspector-image-fit"
            @change="onImageFitChange($event as 'cover')"
          >
            <el-radio-button value="cover">
              {{ t("dataScreen.fitCover") }}
            </el-radio-button>
            <el-radio-button value="contain">
              {{ t("dataScreen.fitContain") }}
            </el-radio-button>
            <el-radio-button value="fill">
              {{ t("dataScreen.fitFill") }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
      </template>

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
          <el-input-number v-model="size" :min="14" :max="200" />
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

      <el-form-item
        v-if="pane.type === 'clock'"
        :label="t('dataScreen.paneFontSize')"
      >
        <el-input-number
          v-model="clockSize"
          :min="14"
          :max="200"
          data-testid="inspector-clock-size"
        />
      </el-form-item>

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
  gap: var(--space-2);
  align-items: center;
  margin-bottom: var(--space-3);
  font-size: var(--el-font-size-small);
  color: var(--screen-fg-dense);
}

.pane-inspector__type {
  padding: 1px 6px;
  font-size: var(--el-font-size-extra-small);
  color: var(--screen-fg-muted);
  background: var(--screen-surface-strong);
  border-radius: var(--radius-full);
}

.pane-inspector__pair {
  display: flex;
  gap: var(--space-2);
  width: 100%;

  :deep(.el-input-number) {
    flex: 1;
    width: auto;
  }
}

.pane-inspector__hint {
  font-size: var(--el-font-size-extra-small);
  line-height: 1.6;
  color: var(--screen-fg-dim);
}

/* 深色画布内的表单：标签与分割线取白色透明度（不随站点主题） */
.pane-inspector :deep(.el-form-item__label) {
  color: var(--screen-fg-muted);
}

.pane-inspector :deep(.el-divider) {
  border-color: var(--screen-border-strong);
}
</style>
