<script lang="ts" setup>
import { computed, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useDebounceFn } from "@vueuse/core";
import { crontabScheduleApi } from "@/api/task/task";
import { isSuccess } from "@/api/types";
import { normalizeError } from "@/utils/apiError";
import { formatCronWeekday } from "../utils/cronWeekday";
import {
  CRON_FIELD_KEYS,
  cronDraftFromRow,
  type CronDraft
} from "../utils/cronDraft";

/**
 * cron 五字段结构化编辑器 + 未来 5 次触发预览。
 *
 * 以合成字段 `cron_expression` 承载整个对象，提交前由 applyCronDraft 拆回
 * minute/hour/day_of_month/month_of_year/day_of_week/timezone 六个独立字段。
 * 预览走后端（与 django_celery_beat 同一解析器 + 时区），不在前端复制解析逻辑。
 */
defineOptions({ name: "CronExpressionField" });

const props = defineProps<{
  modelValue?: Partial<CronDraft> | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: CronDraft];
}>();

const { t, locale } = useI18n();
const draft = reactive<CronDraft>(cronDraftFromRow(props.modelValue));
const fieldKeys = CRON_FIELD_KEYS.filter(item => item !== "timezone");

const nextRuns = ref<string[]>([]);
const previewTimezone = ref("");
const previewLoading = ref(false);
const previewError = ref(false);

const fieldLabels = computed<Record<(typeof CRON_FIELD_KEYS)[number], string>>(
  () => ({
    minute: t("systemTaskCrontab.minute"),
    hour: t("systemTaskCrontab.hour"),
    day_of_month: t("systemTaskCrontab.day_of_month"),
    month_of_year: t("systemTaskCrontab.month_of_year"),
    day_of_week: t("systemTaskCrontab.day_of_week"),
    timezone: t("systemTaskCrontab.timezone")
  })
);

const weekdayHint = computed(() =>
  formatCronWeekday(draft.day_of_week, t, locale.value)
);

const expression = computed(() =>
  [
    draft.minute,
    draft.hour,
    draft.day_of_month,
    draft.month_of_year,
    draft.day_of_week
  ].join(" ")
);

const canPreview = computed(
  () =>
    Boolean(draft.minute.trim()) &&
    Boolean(draft.hour.trim()) &&
    Boolean(draft.day_of_month.trim()) &&
    Boolean(draft.month_of_year.trim()) &&
    Boolean(draft.day_of_week.trim())
);

const emitDraft = () => emit("update:modelValue", { ...draft });

const fetchPreview = useDebounceFn(async () => {
  if (!canPreview.value) {
    nextRuns.value = [];
    previewError.value = false;
    return;
  }
  previewLoading.value = true;
  previewError.value = false;
  try {
    const res = await crontabScheduleApi
      .preview({ ...draft })
      .catch(normalizeError);
    if (isSuccess(res)) {
      nextRuns.value = res.data?.next_runs ?? [];
      previewTimezone.value = res.data?.timezone ?? draft.timezone;
      return;
    }
    nextRuns.value = [];
    previewError.value = true;
  } catch {
    nextRuns.value = [];
    previewError.value = true;
  } finally {
    previewLoading.value = false;
  }
}, 350);

watch(
  draft,
  () => {
    emitDraft();
    fetchPreview();
  },
  { deep: true, immediate: true }
);

/** 常用预设：只覆盖五字段，保留时区 */
const presets = computed(() => [
  { key: "every5", values: ["*/5", "*", "*", "*", "*"] },
  { key: "hourly", values: ["0", "*", "*", "*", "*"] },
  { key: "daily2", values: ["0", "2", "*", "*", "*"] },
  { key: "workday9", values: ["0", "9", "*", "*", "1-5"] }
]);

const applyPreset = (values: string[]) => {
  draft.minute = values[0];
  draft.hour = values[1];
  draft.day_of_month = values[2];
  draft.month_of_year = values[3];
  draft.day_of_week = values[4];
};

const displayRun = (value: string) => value.replace("T", " ").slice(0, 19);
</script>

<template>
  <div class="cron-field">
    <div class="cron-field__presets">
      <el-button
        v-for="preset in presets"
        :key="preset.key"
        size="small"
        plain
        @click="applyPreset(preset.values)"
      >
        {{ t(`systemTaskCrontab.preset_${preset.key}`) }}
      </el-button>
    </div>

    <div class="cron-field__grid">
      <div v-for="key in fieldKeys" :key="key" class="cron-field__item">
        <span class="cron-field__label">{{ fieldLabels[key] }}</span>
        <el-input
          v-model="draft[key]"
          :placeholder="key === 'minute' ? '0,30' : '*'"
        />
      </div>
      <div class="cron-field__item cron-field__item--wide">
        <span class="cron-field__label">{{ fieldLabels.timezone }}</span>
        <el-input
          v-model="draft.timezone"
          class="w-full"
          :placeholder="t('systemTaskCrontab.timezonePlaceholder')"
        />
      </div>
    </div>

    <div class="cron-field__hint">
      {{
        t("systemTaskCrontab.expressionHint", {
          expression,
          weekday: weekdayHint
        })
      }}
    </div>

    <div v-loading="previewLoading" class="cron-field__preview">
      <div class="cron-field__preview-head">
        <span>{{ t("systemTaskCrontab.nextRuns") }}</span>
        <el-tag v-if="previewTimezone" size="small" type="info" effect="plain">
          {{ previewTimezone }}
        </el-tag>
      </div>
      <el-alert
        v-if="previewError"
        :closable="false"
        type="warning"
        :title="t('systemTaskCrontab.previewFailed')"
      />
      <el-empty
        v-else-if="!previewLoading && !nextRuns.length"
        :image-size="48"
        :description="
          canPreview
            ? t('systemTaskCrontab.previewEmpty')
            : t('systemTaskCrontab.previewRequired')
        "
      />
      <ol v-else class="cron-field__runs">
        <li v-for="run in nextRuns" :key="run">{{ displayRun(run) }}</li>
      </ol>
      <div class="cron-field__preview-tip">
        {{ t("systemTaskCrontab.previewHint") }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.cron-field__presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.cron-field__grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.cron-field__item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cron-field__item--wide {
  grid-column: 1 / -1;
}

.cron-field__label {
  font-size: var(--font-size-xs);
  color: var(--el-text-color-secondary);
}

.cron-field__hint {
  margin-top: 8px;
  font-size: var(--font-size-xs);
  color: var(--el-text-color-secondary);
}

.cron-field__preview {
  padding: 10px;
  margin-top: 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
}

.cron-field__preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  font-weight: 500;
}

.cron-field__runs {
  padding-left: 20px;
  margin: 0;
  font-family: var(--el-font-family-mono);
  font-size: var(--font-size-xs);
  line-height: 1.8;
}

.cron-field__preview-tip {
  margin-top: 6px;
  font-size: var(--font-size-xs);
  color: var(--el-text-color-secondary);
}

@media (width <= 720px) {
  .cron-field__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
