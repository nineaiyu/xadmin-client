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
import {
  datasetApi,
  listRows,
  type DatasetItem,
  type DatasetMeta
} from "@/api/system/datasets";
import { choiceValue } from "@/utils/dict";
import DatasetForm from "./components/DatasetForm.vue";

defineOptions({
  name: "DataDataset"
});

const { t } = useI18n();
const canCreate = hasAuth("create:DataDataset");
const canEdit = hasAuth("partialUpdate:DataDataset");
const canDestroy = hasAuth("destroy:DataDataset");
const canExecute = hasAuth("execute:DataDataset");

const loading = ref(false);
const rows = ref<DatasetItem[]>([]);
const meta = ref<DatasetMeta>({ models: [], fields: {} });

const loadAll = async () => {
  loading.value = true;
  try {
    const [listRes, metaRes] = await Promise.all([
      fetchAllRows(datasetApi.list),
      datasetApi.meta()
    ]);
    rows.value = listRows<DatasetItem>(listRes as never);
    if (metaRes.code === SUCCESS_CODE) {
      meta.value = metaRes.data as unknown as DatasetMeta;
    }
  } finally {
    loading.value = false;
  }
};

/** 新建 / 编辑弹窗（C5：统一走 ReDialog，表单在 DatasetForm 中） */
const formRef = ref<InstanceType<typeof DatasetForm>>();

const openDialog = (row: DatasetItem | null) => {
  formRef.value = undefined;
  addDialog({
    title: row ? t("dataDataset.edit") : t("dataDataset.create"),
    width: dialogSize("lg"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    sureBtnLoading: true,
    contentRenderer: () =>
      h(DatasetForm, { ref: formRef, row, meta: meta.value }),
    beforeSure: async (done, { closeLoading }) => {
      const payload = formRef.value?.getPayload();
      if (!payload) {
        closeLoading();
        return;
      }
      // 异常归一为可读失败结果：避免请求异常时 beforeSure 抛错、弹窗 loading 悬挂
      const res = await (
        row
          ? datasetApi.partialUpdate(row.pk, payload)
          : datasetApi.create(payload)
      ).catch(error => ({
        code: -1,
        detail: String((error as { detail?: string })?.detail ?? error)
      }));
      if (res.code === SUCCESS_CODE) {
        message(t("dataDataset.saveOk"), { type: "success" });
        // 先关弹窗再刷新列表（与原手写弹窗行为一致，避免刷新耗时导致弹窗滞留）
        done();
        await loadAll();
        return;
      }
      if (res.detail) message(String(res.detail), { type: "warning" });
      closeLoading();
    }
  });
};

const openCreate = () => openDialog(null);
const openEdit = (row: DatasetItem) => openDialog(row);

const remove = async (row: DatasetItem) => {
  try {
    await ElMessageBox.confirm(
      t("dataDataset.deleteConfirm", { name: row.name }),
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
  const res = await datasetApi.destroy(row.pk);
  if (res.code === SUCCESS_CODE) {
    message(t("dataDataset.saveOk"), { type: "success" });
    await loadAll();
  }
};

// ---- 执行预览 ----
const previewDialog = ref(false);
const preview = ref<{
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
} | null>(null);

const openPreview = async (row: DatasetItem) => {
  const res = await datasetApi.execute(row.pk);
  if (res.code === SUCCESS_CODE) {
    preview.value = res.data as never;
    previewDialog.value = true;
  } else if (res.detail) {
    message(String(res.detail), { type: "warning" });
  }
};

const visibilityLabel = (value: string) =>
  value === "shared" ? t("dataDataset.shared") : t("dataDataset.personal");

onMounted(loadAll);
</script>

<template>
  <div class="pr-[1%]">
    <!-- pr-[1%]：内容宽度对齐 RePlusPage 的 w-99/100（右侧留 1%），
         根元素自带 layout 注入的 main-content（24px 外边距），不能再设百分比宽度（会溢出） -->
    <el-card shadow="never">
      <div class="mb-3 flex items-center gap-2">
        <span class="font-semibold">{{ t("dataDataset.title") }}</span>
        <div class="flex-1" />
        <el-button v-if="canCreate" type="primary" @click="openCreate">
          {{ t("dataDataset.create") }}
        </el-button>
      </div>
      <el-table v-loading="loading" :data="rows" data-testid="dataset-table">
        <el-table-column
          prop="name"
          :label="t('dataDataset.name')"
          min-width="140"
        />
        <el-table-column
          prop="bound_model"
          :label="t('dataDataset.model')"
          min-width="160"
        />
        <el-table-column
          prop="visibility"
          :label="t('dataDataset.visibilityLabel')"
          width="90"
        >
          <template #default="{ row }">
            <el-tag
              :type="
                choiceValue(row.visibility) === 'shared' ? 'success' : 'info'
              "
              size="small"
            >
              {{ visibilityLabel(choiceValue(row.visibility)) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="description"
          :label="t('dataDataset.description')"
          min-width="180"
          show-overflow-tooltip
        />
        <el-table-column
          :label="t('dataDataset.actions')"
          width="220"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              v-if="canExecute"
              link
              type="primary"
              @click="openPreview(row as DatasetItem)"
            >
              {{ t("dataDataset.preview") }}
            </el-button>
            <el-button
              v-if="canEdit"
              link
              type="primary"
              @click="openEdit(row as DatasetItem)"
            >
              {{ t("dataDataset.edit") }}
            </el-button>
            <el-button
              v-if="canDestroy"
              link
              type="danger"
              @click="remove(row as DatasetItem)"
            >
              {{ t("dataDataset.delete") }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新建 / 编辑 -->
    <!-- 执行预览 -->
    <el-dialog
      v-model="previewDialog"
      :title="t('dataDataset.preview')"
      width="720px"
    >
      <p class="mb-2 text-sm text-gray-500">
        {{ t("dataDataset.total") }}: {{ preview?.total ?? 0 }}
      </p>
      <el-table :data="preview?.rows ?? []" max-height="380">
        <el-table-column
          v-for="col in preview?.columns ?? []"
          :key="col"
          :prop="col"
          :label="col"
          min-width="120"
          show-overflow-tooltip
        />
      </el-table>
    </el-dialog>
  </div>
</template>
