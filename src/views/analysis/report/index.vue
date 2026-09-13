<script lang="ts" setup>
import { onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { datasetApi, listRows, type DatasetItem } from "@/api/system/datasets";
import {
  listRows as listAnalysisRows,
  reportApi,
  runReport,
  type ReportItem
} from "@/api/system/analysis";

defineOptions({
  name: "DataReport"
});

const { t } = useI18n();
const canCreate = hasAuth("create:DataReport");
const canEdit = hasAuth("partialUpdate:DataReport");
const canDestroy = hasAuth("destroy:DataReport");
const canRun = hasAuth("run:DataReport");

const loading = ref(false);
const rows = ref<ReportItem[]>([]);
const datasets = ref<DatasetItem[]>([]);
const selectedDataset = ref<DatasetItem | null>(null);

const loadAll = async () => {
  loading.value = true;
  try {
    const [reportRes, datasetRes] = await Promise.all([
      reportApi.list({ page_size: 100 }),
      datasetApi.list({ page_size: 100 })
    ]);
    rows.value = listAnalysisRows<ReportItem>(reportRes as never);
    datasets.value = listRows<DatasetItem>(datasetRes as never);
  } finally {
    loading.value = false;
  }
};

const dialog = ref(false);
const editingPk = ref<string | null>(null);
const form = reactive({
  name: "",
  dataset: "",
  mode: "rows" as "rows" | "aggregate",
  group_by: "",
  metric: "count" as "count" | "sum" | "avg",
  date_trunc: "day",
  value_field: "",
  frequency: "daily" as "daily" | "weekly" | "monthly",
  send_time: "08:00",
  weekday: 0,
  recipients: "",
  is_active: true
});

const openCreate = () => {
  editingPk.value = null;
  Object.assign(form, {
    name: "",
    dataset: "",
    mode: "rows",
    group_by: "",
    metric: "count",
    date_trunc: "day",
    value_field: "",
    frequency: "daily",
    send_time: "08:00",
    weekday: 0,
    recipients: "",
    is_active: true
  });
  selectedDataset.value = null;
  dialog.value = true;
};

const openEdit = (row: ReportItem) => {
  editingPk.value = row.pk;
  Object.assign(form, {
    ...JSON.parse(JSON.stringify(row)),
    recipients: (row.recipients ?? []).join(", ")
  });
  selectedDataset.value =
    datasets.value.find(item => item.pk === row.dataset) ?? null;
  dialog.value = true;
};

const onDatasetPicked = (pk: string) => {
  selectedDataset.value = datasets.value.find(item => item.pk === pk) ?? null;
  form.group_by = selectedDataset.value?.columns[0] ?? "";
};

const submit = async () => {
  if (!form.name || !form.dataset) {
    message(t("dataReport.required"), { type: "warning" });
    return;
  }
  const recipients = form.recipients.split(/[,;\s]+/).filter(Boolean);
  const payload = {
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
    recipients,
    is_active: form.is_active
  };
  const res = editingPk.value
    ? await reportApi.partialUpdate(editingPk.value, payload)
    : await reportApi.create(payload);
  if (res.code === 1000) {
    message(t("dataReport.saveOk"), { type: "success" });
    dialog.value = false;
    await loadAll();
  } else if (res.detail) {
    message(String(res.detail), { type: "warning" });
  }
};

const remove = async (row: ReportItem) => {
  const res = await reportApi.destroy(row.pk);
  if (res.code === 1000) await loadAll();
};

const run = async (row: ReportItem) => {
  const res = await runReport(row.pk);
  if (res.code === 1000) {
    message(t("dataReport.runOk"), { type: "success" });
    await loadAll();
  } else if (res.detail) {
    message(String(res.detail), { type: "warning" });
  }
};

const statusTag = (status: string) =>
  status === "SUCCESS"
    ? "success"
    : status === "FAILURE"
      ? "danger"
      : status
        ? "warning"
        : "info";

const datasetName = (pk: string) =>
  datasets.value.find(item => item.pk === pk)?.name ?? pk;

onMounted(loadAll);
</script>

<template>
  <div class="pr-[1%]">
    <!-- pr-[1%]：内容宽度对齐 RePlusPage 的 w-99/100（右侧留 1%），
         根元素自带 layout 注入的 main-content（24px 外边距），不能再设百分比宽度（会溢出） -->
    <el-card shadow="never">
      <div class="mb-3 flex items-center gap-2">
        <span class="font-semibold">{{ t("dataReport.title") }}</span>
        <div class="flex-1" />
        <el-button v-if="canCreate" type="primary" @click="openCreate">
          {{ t("dataReport.create") }}
        </el-button>
      </div>
      <el-table v-loading="loading" :data="rows">
        <el-table-column
          prop="name"
          :label="t('dataReport.name')"
          min-width="140"
        />
        <el-table-column :label="t('dataReport.dataset')" min-width="140">
          <template #default="{ row }">{{
            datasetName((row as ReportItem).dataset)
          }}</template>
        </el-table-column>
        <el-table-column
          prop="frequency"
          :label="t('dataReport.frequency')"
          width="90"
        />
        <el-table-column
          prop="send_time"
          :label="t('dataReport.sendTime')"
          width="90"
        />
        <el-table-column
          :label="t('dataReport.recipients')"
          min-width="180"
          show-overflow-tooltip
        >
          <template #default="{ row }">{{
            ((row as ReportItem).recipients || []).join(", ")
          }}</template>
        </el-table-column>
        <el-table-column :label="t('dataReport.lastStatus')" width="120">
          <template #default="{ row }">
            <el-tag
              v-if="(row as ReportItem).last_status"
              size="small"
              :type="statusTag((row as ReportItem).last_status)"
            >
              {{ (row as ReportItem).last_status }}
            </el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column
          :label="t('dataReport.actions')"
          width="200"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              v-if="canRun"
              link
              type="success"
              @click="run(row as ReportItem)"
            >
              {{ t("dataReport.run") }}
            </el-button>
            <el-button
              v-if="canEdit"
              link
              type="primary"
              @click="openEdit(row as ReportItem)"
            >
              {{ t("dataReport.edit") }}
            </el-button>
            <el-button
              v-if="canDestroy"
              link
              type="danger"
              @click="remove(row as ReportItem)"
            >
              {{ t("dataReport.delete") }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialog"
      :title="editingPk ? t('dataReport.edit') : t('dataReport.create')"
      width="560px"
    >
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
            <el-select v-model="form.metric" class="w-full">
              <el-option value="count" :label="t('dataReport.metricCount')" />
              <el-option value="sum" :label="t('dataReport.metricSum')" />
              <el-option value="avg" :label="t('dataReport.metricAvg')" />
            </el-select>
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
          <el-input
            v-model="form.send_time"
            class="w-32!"
            placeholder="08:00"
          />
          <el-select
            v-if="form.frequency === 'weekly'"
            v-model="form.weekday"
            class="ml-2 w-32"
          >
            <el-option
              v-for="(label, index) in [
                '周一',
                '周二',
                '周三',
                '周四',
                '周五',
                '周六',
                '周日'
              ]"
              :key="index"
              :value="index"
              :label="label"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('dataReport.recipients')" required>
          <el-input
            v-model="form.recipients"
            :placeholder="t('dataReport.recipientsHint')"
          />
        </el-form-item>
        <el-form-item :label="t('dataReport.isActive')">
          <el-switch v-model="form.is_active" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">{{
          t("dataReport.cancel")
        }}</el-button>
        <el-button type="primary" @click="submit">{{
          t("dataReport.confirm")
        }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>
