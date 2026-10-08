<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { choiceValue } from "@/utils/dict";
import { message } from "@/utils/message";
import type { DatasetItem } from "@/api/dataset/datasets";
import {
  relatedPk,
  searchReportUsers,
  type ReportItem,
  type ReportUserOption
} from "@/api/dataset/analysis";
import {
  FALLBACK_CHANNEL_VALUES,
  FALLBACK_IM_CHANNEL_VALUES,
  channelLabelKey,
  loadReportChannels
} from "../utils/channels";

/**
 * 定时报表表单（C5：弹窗体系收敛到 ReDialog 的 content 组件形态）。
 *
 * 组件负责「表单数据 + 数据集联动 + 载荷生成」，提交与列表刷新由页面在
 * `beforeSure` 中处理；校验失败返回 null，调用方保持弹窗打开。
 */
defineOptions({ name: "AnalysisReportForm" });

const props = defineProps<{
  /** 编辑时的原始行（null / 缺省 = 新建） */
  row?: ReportItem | null;
  /** 可选数据集（由页面加载后传入，驱动分组字段选项） */
  datasets: DatasetItem[];
}>();

const { t } = useI18n();

const form = reactive({
  name: props.row?.name ?? "",
  // dataset 为关联对象 {pk,label}（label 与 pk 同值）：下拉值必须是标量 pk，
  // 直接回显对象会与 el-option 的 pk 值失配、原样提交还会把对象写回接口
  dataset: relatedPk(props.row?.dataset),
  // mode/frequency 带 choices，接口下发 {value,label} 对象；不归一化会让 radio 警告，
  // 且 mode 判断失效会把聚合报表的 date_trunc 误清空
  mode: (props.row ? choiceValue(props.row.mode) : "rows") as
    "rows" | "aggregate",
  group_by: props.row?.group_by ?? "",
  metric: (props.row?.metric as "count" | "sum" | "avg") ?? "count",
  date_trunc: props.row?.date_trunc ?? "day",
  value_field: props.row?.value_field ?? "",
  frequency: (props.row ? choiceValue(props.row.frequency) : "daily") as
    "daily" | "weekly" | "monthly",
  send_time: props.row?.send_time ?? "08:00",
  weekday: props.row?.weekday ?? 0,
  // 每月几号（monthly 用，1~28 避开月末歧义）
  month_day: props.row?.month_day ?? 1,
  // cron 表达式：非空时优先于上面三档频次
  cron_expression: props.row?.cron_expression ?? "",
  recipients: (props.row?.recipients ?? []).join(", "),
  // 投递渠道：空 = 仅邮件（存量数据兼容）；新建默认勾选邮件
  notify_channels: props.row?.notify_channels?.length
    ? [...props.row.notify_channels]
    : ["email"],
  im_recipients: [...(props.row?.im_recipients ?? [])],
  is_active: props.row?.is_active ?? true
});

/** 每周投递日选项（0=周一，与后端 Report.weekday 语义对齐；文案走 i18n） */
const weekdayOptions = computed(() =>
  Array.from({ length: 7 }, (_, index) => ({
    value: index,
    label: t(`dataReport.weekday${index}`)
  }))
);

/** 渠道选项：值集来自后端 choices（不可达时回落兜底清单），文案走 i18n；
 *  已选中的未知取值一并呈现，避免存量数据在表单里「消失」 */
const channelValues = ref<string[]>([...FALLBACK_CHANNEL_VALUES]);
const imChannelValues = ref<string[]>([...FALLBACK_IM_CHANNEL_VALUES]);
const channelOptions = computed(() => {
  const values = [...channelValues.value];
  for (const value of form.notify_channels) {
    if (!values.includes(value)) values.push(value);
  }
  return values.map(value => {
    const key = channelLabelKey(value);
    return { value, label: key ? t(key) : value };
  });
});
const emailSelected = computed(() => form.notify_channels.includes("email"));
const imSelected = computed(() =>
  form.notify_channels.some(item => imChannelValues.value.includes(item))
);

/** IM 接收人候选缓存：远程搜索与编辑回显共用 */
const userOptions = reactive<ReportUserOption[]>([]);
const userLabel = (user: ReportUserOption) =>
  user.nickname ? `${user.username}-${user.nickname}` : user.username;

const mergeUsers = (rows: ReportUserOption[]) => {
  const known = new Set(userOptions.map(item => item.pk));
  for (const row of rows) {
    if (!known.has(row.pk)) userOptions.push(row);
  }
};

const searchUsers = (keyword: string) => {
  const value = (keyword ?? "").trim();
  if (!value) return;
  searchReportUsers({ keyword: value })
    .then(res => mergeUsers(res?.data ?? []))
    .catch(() => undefined);
};

/** 编辑既有报表：按主键回显已选接收人（避免无边界的通讯录枚举） */
onMounted(async () => {
  if (form.im_recipients.length) {
    searchReportUsers({ pks: form.im_recipients })
      .then(res => mergeUsers(res?.data ?? []))
      .catch(() => undefined);
  }
  // 渠道值集来自后端 choices（失败回落兜底清单）：新增渠道无需前端改代码
  const channels = await loadReportChannels();
  channelValues.value = channels.channels;
  imChannelValues.value = channels.imChannels;
});

/** 当前数据集（驱动分组字段候选） */
const selectedDataset = computed(
  () => props.datasets.find(item => item.pk === form.dataset) ?? null
);

/** sum/avg 的数值字段候选（后端聚合要求数值列；无元数据时回落全列） */
const numericColumns = computed(() => {
  const numeric = selectedDataset.value?.numeric_columns ?? [];
  return numeric.length ? numeric : (selectedDataset.value?.columns ?? []);
});

const needsValueField = computed(
  () =>
    form.mode === "aggregate" &&
    (form.metric === "sum" || form.metric === "avg")
);

/** 数据集切换联动：分组字段重置为该数据集首列，清空数值字段 */
const onDatasetPicked = () => {
  form.group_by = selectedDataset.value?.columns[0] ?? "";
  form.value_field = "";
};

/** 指标切换联动：sum/avg 需要数值字段（缺省自动带上首个数值列） */
const onMetricChanged = () => {
  if (needsValueField.value && !form.value_field) {
    form.value_field = numericColumns.value[0] ?? "";
  }
  if (!needsValueField.value) {
    form.value_field = "";
  }
};

/** cron 表达式轻校验：非空时要求 5 段（与服务端 croniter 校验同口径的前置拦截） */
const cronExpressionValid = computed(() => {
  const value = form.cron_expression.trim();
  if (!value) return true;
  return value.split(/\s+/).length === 5;
});

/** 邮箱轻校验：本地@域名（与后端 EmailValidator 非严格对齐，拦截明显非法输入） */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 校验并生成提交载荷；校验失败返回 null（调用方保持弹窗打开） */
const getPayload = (): Record<string, unknown> | null => {
  if (!form.name || !form.dataset) {
    message(t("dataReport.required"), { type: "warning" });
    return null;
  }
  if (!form.notify_channels.length) {
    message(t("dataReport.channelRequired"), { type: "warning" });
    return null;
  }
  // 聚合报表的 sum/avg 必须指定数值字段（否则执行期必然 FAILURE，提前拦截）
  if (needsValueField.value && !form.value_field) {
    message(t("dataReport.valueFieldRequired"), { type: "warning" });
    return null;
  }
  if (!cronExpressionValid.value) {
    message(t("dataReport.cronInvalid"), { type: "warning" });
    return null;
  }
  const recipients = form.recipients.split(/[,;\s]+/).filter(Boolean);
  // 邮件渠道必有收件人且逐个过邮箱格式（模板已标必填，这里前置拦截避免执行期必失败）
  if (emailSelected.value) {
    if (recipients.length === 0) {
      message(t("dataReport.recipientsRequired"), { type: "warning" });
      return null;
    }
    const invalid = recipients.find(item => !EMAIL_RE.test(item));
    if (invalid) {
      message(t("dataReport.recipientsInvalid", { value: invalid }), {
        type: "warning"
      });
      return null;
    }
  }
  return {
    name: form.name,
    dataset: form.dataset,
    mode: form.mode,
    group_by: form.group_by,
    metric: form.metric,
    date_trunc: form.mode === "aggregate" ? form.date_trunc : "",
    value_field: form.value_field,
    frequency: form.frequency,
    send_time: form.send_time,
    weekday: Number(form.weekday),
    month_day: Number(form.month_day),
    cron_expression: form.cron_expression.trim(),
    recipients,
    notify_channels: [...form.notify_channels],
    im_recipients: [...form.im_recipients],
    is_active: form.is_active
  };
};

defineExpose({ getPayload });
</script>

<template>
  <el-form label-width="100px">
    <el-form-item :label="t('dataReport.name')" required>
      <el-input v-model="form.name" />
    </el-form-item>
    <el-form-item :label="t('dataReport.dataset')" required>
      <el-select
        v-model="form.dataset"
        class="w-full"
        filterable
        @change="onDatasetPicked"
      >
        <el-option
          v-for="item in datasets"
          :key="item.pk"
          :value="item.pk"
          :label="item.name"
        />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('dataReport.mode')">
      <el-radio-group v-model="form.mode">
        <el-radio value="rows">{{ t("dataReport.modeRows") }}</el-radio>
        <el-radio value="aggregate">{{
          t("dataReport.modeAggregate")
        }}</el-radio>
      </el-radio-group>
    </el-form-item>
    <template v-if="form.mode === 'aggregate'">
      <el-form-item :label="t('dataReport.groupBy')">
        <el-select v-model="form.group_by" class="w-full" filterable>
          <el-option
            v-for="f in selectedDataset?.columns ?? []"
            :key="f"
            :value="f"
            :label="f"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('dataReport.metric')">
        <el-select
          v-model="form.metric"
          class="w-full"
          @change="onMetricChanged"
        >
          <el-option value="count" :label="t('dataReport.metricCount')" />
          <el-option value="sum" :label="t('dataReport.metricSum')" />
          <el-option value="avg" :label="t('dataReport.metricAvg')" />
        </el-select>
      </el-form-item>
      <el-form-item v-if="needsValueField" :label="t('dataReport.valueField')">
        <el-select v-model="form.value_field" class="w-full" filterable>
          <el-option
            v-for="f in numericColumns"
            :key="f"
            :value="f"
            :label="f"
          />
        </el-select>
        <div class="text-xs text-(--el-text-color-secondary)">
          {{ t("dataReport.valueFieldTip") }}
        </div>
      </el-form-item>
      <el-form-item :label="t('dataReport.dateTrunc')">
        <el-select v-model="form.date_trunc" class="w-full" clearable>
          <el-option value="day" :label="t('dataReport.byDay')" />
          <el-option value="month" :label="t('dataReport.byMonth')" />
        </el-select>
      </el-form-item>
    </template>
    <el-form-item :label="t('dataReport.frequency')">
      <el-radio-group v-model="form.frequency">
        <el-radio value="daily">{{ t("dataReport.daily") }}</el-radio>
        <el-radio value="weekly">{{ t("dataReport.weekly") }}</el-radio>
        <el-radio value="monthly">{{ t("dataReport.monthly") }}</el-radio>
      </el-radio-group>
    </el-form-item>
    <el-form-item :label="t('dataReport.sendTime')">
      <!-- 时间选择器：HH:mm 5 分钟步进（值为 "08:00" 形态，与服务端 SEND_TIME_RE 同口径） -->
      <el-time-select
        v-model="form.send_time"
        class="w-32!"
        start="00:00"
        step="00:05"
        end="23:55"
        placeholder="08:00"
      />
      <el-select
        v-if="form.frequency === 'weekly'"
        v-model="form.weekday"
        class="ml-2 w-32"
      >
        <el-option
          v-for="item in weekdayOptions"
          :key="item.value"
          :value="item.value"
          :label="item.label"
        />
      </el-select>
      <el-input-number
        v-if="form.frequency === 'monthly'"
        v-model="form.month_day"
        class="ml-2 w-32!"
        :min="1"
        :max="28"
        controls-position="right"
      />
      <span
        v-if="form.frequency === 'monthly'"
        class="ml-2 text-xs text-(--el-text-color-secondary)"
      >
        {{ t("dataReport.monthDayHint") }}
      </span>
    </el-form-item>
    <el-form-item :label="t('dataReport.cronExpression')">
      <el-input
        v-model="form.cron_expression"
        class="w-64!"
        placeholder="0 9 * * 1-5"
      />
      <span class="ml-2 text-xs text-(--el-text-color-secondary)">
        {{ t("dataReport.cronHint") }}
      </span>
    </el-form-item>
    <el-form-item :label="t('dataReport.notifyChannels')">
      <el-checkbox-group v-model="form.notify_channels">
        <el-checkbox
          v-for="channel in channelOptions"
          :key="channel.value"
          :value="channel.value"
        >
          {{ channel.label }}
        </el-checkbox>
      </el-checkbox-group>
      <div class="text-xs text-(--el-text-color-secondary)">
        {{ t("dataReport.notifyChannelsHint") }}
      </div>
    </el-form-item>
    <el-form-item
      v-if="emailSelected"
      :label="t('dataReport.recipients')"
      required
    >
      <el-input
        v-model="form.recipients"
        :placeholder="t('dataReport.recipientsHint')"
      />
    </el-form-item>
    <el-form-item v-if="imSelected" :label="t('dataReport.imRecipients')">
      <el-select
        v-model="form.im_recipients"
        class="w-full"
        multiple
        filterable
        remote
        reserve-keyword
        clearable
        :remote-method="searchUsers"
        :placeholder="t('dataReport.imRecipientsHint')"
      >
        <el-option
          v-for="user in userOptions"
          :key="user.pk"
          :value="user.pk"
          :label="userLabel(user)"
        />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('dataReport.isActive')">
      <el-switch v-model="form.is_active" />
    </el-form-item>
  </el-form>
</template>
