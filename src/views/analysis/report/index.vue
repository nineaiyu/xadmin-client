<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { h, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessageBox } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { datasetApi, listRows, type DatasetItem } from "@/api/system/datasets";
import {
  listRows as listAnalysisRows,
  reportApi,
  runReport,
  type ReportItem
} from "@/api/system/analysis";
import { choiceValue } from "@/utils/dict";
import ReportForm from "./components/ReportForm.vue";

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

const loadAll = async () => {
  loading.value = true;
  try {
    const [reportRes, datasetRes] = await Promise.all([
      fetchAllRows(reportApi.list),
      fetchAllRows(datasetApi.list)
    ]);
    rows.value = listAnalysisRows<ReportItem>(reportRes as never);
    datasets.value = listRows<DatasetItem>(datasetRes as never);
  } finally {
    loading.value = false;
  }
};

/** 新建 / 编辑弹窗（C5：统一走 ReDialog，表单在 ReportForm 中） */
const formRef = ref<InstanceType<typeof ReportForm>>();

const openDialog = (row: ReportItem | null) => {
  formRef.value = undefined;
  addDialog({
    title: row ? t("dataReport.edit") : t("dataReport.create"),
    width: dialogSize("md"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    sureBtnLoading: true,
    contentRenderer: () =>
      h(ReportForm, { ref: formRef, row, datasets: datasets.value }),
    beforeSure: async (done, { closeLoading }) => {
      const payload = formRef.value?.getPayload();
      if (!payload) {
        closeLoading();
        return;
      }
      const res = row
        ? await reportApi.partialUpdate(row.pk, payload)
        : await reportApi.create(payload);
      if (res.code === SUCCESS_CODE) {
        message(t("dataReport.saveOk"), { type: "success" });
        await loadAll();
        done();
        return;
      }
      if (res.detail) message(String(res.detail), { type: "warning" });
      closeLoading();
    }
  });
};

const openCreate = () => openDialog(null);
const openEdit = (row: ReportItem) => openDialog(row);

const remove = async (row: ReportItem) => {
  try {
    await ElMessageBox.confirm(
      t("dataReport.deleteConfirm", { name: row.name }),
      {
        confirmButtonText: t("buttons.sure"),
        cancelButtonText: t("buttons.cancel"),
        type: "warning",
        confirmButtonClass: "el-button--danger",
        draggable: true
      }
    );
  } catch {
    return;
  }
  const res = await reportApi.destroy(row.pk);
  if (res.code === SUCCESS_CODE) await loadAll();
};

const run = async (row: ReportItem) => {
  const res = await runReport(row.pk);
  if (res.code === SUCCESS_CODE) {
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
        <el-table-column :label="t('dataReport.frequency')" width="90">
          <template #default="{ row }">
            {{ choiceValue((row as ReportItem).frequency) }}
          </template>
        </el-table-column>
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
  </div>
</template>
