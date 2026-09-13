<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import {
  datasetApi,
  listRows,
  type DatasetFilter,
  type DatasetItem,
  type DatasetMeta
} from "@/api/system/datasets";

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
      datasetApi.list({ page_size: 100 }),
      datasetApi.meta()
    ]);
    rows.value = listRows<DatasetItem>(listRes as never);
    if (metaRes.code === 1000) {
      meta.value = metaRes.data as unknown as DatasetMeta;
    }
  } finally {
    loading.value = false;
  }
};

const fieldOptions = computed(() => meta.value.fields[form.bound_model] ?? []);

// ---- 新建 / 编辑 ----
const dialog = ref(false);
const editingPk = ref<string | null>(null);
const form = reactive({
  name: "",
  description: "",
  bound_model: "",
  columns: [] as string[],
  filters: [] as DatasetFilter[],
  ordering: "",
  row_limit: 1000,
  visibility: "personal" as "personal" | "shared",
  date_field: ""
});

const opOptions = [
  "exact",
  "in",
  "gte",
  "gt",
  "lte",
  "lt",
  "contains",
  "startswith",
  "isnull"
];

const resetForm = () => {
  form.name = "";
  form.description = "";
  form.bound_model = "";
  form.columns = [];
  form.filters = [];
  form.ordering = "";
  form.row_limit = 1000;
  form.visibility = "personal";
  form.date_field = "";
};

const openCreate = () => {
  editingPk.value = null;
  resetForm();
  dialog.value = true;
};

const openEdit = (row: DatasetItem) => {
  editingPk.value = row.pk;
  Object.assign(form, {
    name: row.name,
    description: row.description,
    bound_model: row.bound_model,
    columns: [...row.columns],
    filters: JSON.parse(JSON.stringify(row.filters ?? [])),
    ordering: row.ordering,
    row_limit: row.row_limit,
    visibility: row.visibility,
    date_field: row.config?.date_field ?? ""
  });
  dialog.value = true;
};

const onModelChanged = () => {
  form.columns = [];
  form.filters = [];
  form.ordering = "";
  form.date_field = "";
};

const addFilter = () => {
  form.filters.push({
    field: fieldOptions.value[0] ?? "",
    op: "exact",
    value: ""
  });
};

const removeFilter = (index: number) => {
  form.filters.splice(index, 1);
};

const buildPayload = () => ({
  name: form.name,
  description: form.description,
  bound_model: form.bound_model,
  columns: form.columns,
  filters: form.filters.map(item => ({
    field: item.field,
    op: item.op,
    value: item.op === "isnull" ? Boolean(item.value) : item.value
  })),
  ordering: form.ordering,
  row_limit: Number(form.row_limit) || 1000,
  visibility: form.visibility,
  config: form.date_field ? { date_field: form.date_field } : {}
});

const submit = async () => {
  if (!form.name || !form.bound_model || form.columns.length === 0) {
    message(t("dataDataset.required"), { type: "warning" });
    return;
  }
  const res = editingPk.value
    ? await datasetApi.partialUpdate(editingPk.value, buildPayload())
    : await datasetApi.create(buildPayload());
  if (res.code === 1000) {
    message(t("dataDataset.saveOk"), { type: "success" });
    dialog.value = false;
    await loadAll();
  } else if (res.detail) {
    message(String(res.detail), { type: "warning" });
  }
};

const remove = async (row: DatasetItem) => {
  const res = await datasetApi.destroy(row.pk);
  if (res.code === 1000) {
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
  if (res.code === 1000) {
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
  <div class="p-4">
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
              :type="row.visibility === 'shared' ? 'success' : 'info'"
              size="small"
            >
              {{ visibilityLabel(row.visibility) }}
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
    <el-dialog
      v-model="dialog"
      :title="editingPk ? t('dataDataset.edit') : t('dataDataset.create')"
      width="640px"
    >
      <el-form label-width="100px">
        <el-form-item :label="t('dataDataset.name')" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item :label="t('dataDataset.model')" required>
          <el-select
            v-model="form.bound_model"
            class="w-full"
            filterable
            :disabled="Boolean(editingPk)"
            @change="onModelChanged"
          >
            <el-option
              v-for="m in meta.models"
              :key="m"
              :value="m"
              :label="m"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('dataDataset.columns')" required>
          <el-select v-model="form.columns" class="w-full" multiple filterable>
            <el-option
              v-for="f in fieldOptions"
              :key="f"
              :value="f"
              :label="f"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('dataDataset.filters')">
          <div class="w-full">
            <div
              v-for="(item, index) in form.filters"
              :key="index"
              class="mb-2 flex gap-2"
            >
              <el-select v-model="item.field" class="w-44" filterable>
                <el-option
                  v-for="f in fieldOptions"
                  :key="f"
                  :value="f"
                  :label="f"
                />
              </el-select>
              <el-select v-model="item.op" class="w-36">
                <el-option
                  v-for="op in opOptions"
                  :key="op"
                  :value="op"
                  :label="op"
                />
              </el-select>
              <el-input
                v-if="item.op !== 'isnull'"
                v-model="item.value as string"
                class="flex-1"
                :placeholder="
                  item.op === 'in'
                    ? t('dataDataset.inHint')
                    : t('dataDataset.value')
                "
              />
              <el-button link type="danger" @click="removeFilter(index)">
                {{ t("dataDataset.delete") }}
              </el-button>
            </div>
            <el-button @click="addFilter">{{
              t("dataDataset.addFilter")
            }}</el-button>
          </div>
        </el-form-item>
        <el-form-item :label="t('dataDataset.ordering')">
          <el-select
            v-model="form.ordering"
            class="w-full"
            clearable
            filterable
          >
            <el-option
              v-for="f in form.columns"
              :key="f"
              :value="f"
              :label="f"
            />
            <el-option
              v-for="f in form.columns"
              :key="`-${f}`"
              :value="`-${f}`"
              :label="`-${f}`"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('dataDataset.rowLimit')">
          <el-input-number v-model="form.row_limit" :min="1" :max="5000" />
        </el-form-item>
        <el-form-item :label="t('dataDataset.dateField')">
          <el-select
            v-model="form.date_field"
            class="w-full"
            clearable
            filterable
          >
            <el-option
              v-for="f in fieldOptions"
              :key="f"
              :value="f"
              :label="f"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('dataDataset.visibilityLabel')">
          <el-radio-group v-model="form.visibility">
            <el-radio value="personal">{{
              t("dataDataset.personal")
            }}</el-radio>
            <el-radio value="shared">{{ t("dataDataset.shared") }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="t('dataDataset.description')">
          <el-input v-model="form.description" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">{{
          t("dataDataset.cancel")
        }}</el-button>
        <el-button type="primary" @click="submit">{{
          t("dataDataset.confirm")
        }}</el-button>
      </template>
    </el-dialog>

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
