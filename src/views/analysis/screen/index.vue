<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { ElMessageBox } from "element-plus";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import {
  listRows,
  listDashboards,
  screenApi,
  type ScreenItem
} from "@/api/system/analysis";
import { choiceValue } from "@/utils/dict";

defineOptions({
  name: "DataScreen"
});

const { t } = useI18n();
const router = useRouter();
const canCreate = hasAuth("create:DataScreen");
const canEdit = hasAuth("partialUpdate:DataScreen");
const canDestroy = hasAuth("destroy:DataScreen");

const loading = ref(false);
const rows = ref<ScreenItem[]>([]);
const dashboards = ref<{ pk: string; name: string }[]>([]);

const loadAll = async () => {
  loading.value = true;
  try {
    const [listRes, dashRes] = await Promise.all([
      fetchAllRows(screenApi.list),
      listDashboards()
    ]);
    rows.value = listRows<ScreenItem>(listRes as never);
    dashboards.value = dashRes.map(item => ({ pk: item.pk, name: item.name }));
  } finally {
    loading.value = false;
  }
};

const dialog = ref(false);
const editingPk = ref<string | null>(null);
const form = reactive({
  name: "",
  dashboards: [] as string[],
  interval: 15,
  refresh: 60,
  visibility: "shared" as "personal" | "shared"
});

const openCreate = () => {
  editingPk.value = null;
  form.name = "";
  form.dashboards = [];
  form.interval = 15;
  form.refresh = 60;
  form.visibility = "shared";
  dialog.value = true;
};

const openEdit = (row: ScreenItem) => {
  editingPk.value = row.pk;
  Object.assign(form, JSON.parse(JSON.stringify(row)));
  // visibility 序列化为 {value,label} 对象，radio 只接受标量（归一化取 value）
  form.visibility = choiceValue(row.visibility) as "personal" | "shared";
  dialog.value = true;
};

const submit = async () => {
  if (!form.name || form.dashboards.length === 0) {
    message(t("dataScreen.required"), { type: "warning" });
    return;
  }
  const res = editingPk.value
    ? await screenApi.partialUpdate(editingPk.value, { ...form })
    : await screenApi.create({ ...form });
  if (res.code === SUCCESS_CODE) {
    message(t("dataScreen.saveOk"), { type: "success" });
    dialog.value = false;
    await loadAll();
  } else if (res.detail) {
    message(String(res.detail), { type: "warning" });
  }
};

const remove = async (row: ScreenItem) => {
  try {
    await ElMessageBox.confirm(
      t("dataScreen.deleteConfirm", { name: row.name }),
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
  const res = await screenApi.destroy(row.pk);
  if (res.code === SUCCESS_CODE) {
    await loadAll();
  }
};

/** 投屏：新开独立全屏页（隐藏静态路由） */
const display = (row: ScreenItem) => {
  router.push({ path: "/analysis/screen/display", query: { pk: row.pk } });
};

const dashboardName = (pk: string) =>
  dashboards.value.find(item => item.pk === pk)?.name ?? pk;

const visibilityLabel = (value: string) =>
  value === "shared" ? t("dataScreen.shared") : t("dataScreen.personal");

onMounted(loadAll);
</script>

<template>
  <div class="pr-[1%]">
    <!-- pr-[1%]：内容宽度对齐 RePlusPage 的 w-99/100（右侧留 1%），
         根元素自带 layout 注入的 main-content（24px 外边距），不能再设百分比宽度（会溢出） -->
    <el-card shadow="never">
      <div class="mb-3 flex items-center gap-2">
        <span class="font-semibold">{{ t("dataScreen.title") }}</span>
        <div class="flex-1" />
        <el-button v-if="canCreate" type="primary" @click="openCreate">
          {{ t("dataScreen.create") }}
        </el-button>
      </div>
      <el-table v-loading="loading" :data="rows">
        <el-table-column
          prop="name"
          :label="t('dataScreen.name')"
          min-width="140"
        />
        <el-table-column :label="t('dataScreen.dashboards')" min-width="220">
          <template #default="{ row }">
            {{
              (row.dashboards || [])
                .map((pk: string) => dashboardName(pk))
                .join(" → ")
            }}
          </template>
        </el-table-column>
        <el-table-column
          prop="interval"
          :label="t('dataScreen.interval')"
          width="100"
        />
        <el-table-column
          prop="refresh"
          :label="t('dataScreen.refresh')"
          width="100"
        />
        <el-table-column :label="t('dataScreen.visibilityLabel')" width="90">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="
                choiceValue(row.visibility) === 'shared' ? 'success' : 'info'
              "
            >
              {{ visibilityLabel(choiceValue(row.visibility)) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="t('dataScreen.actions')"
          width="220"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button link type="success" @click="display(row as ScreenItem)">
              {{ t("dataScreen.display") }}
            </el-button>
            <el-button
              v-if="canEdit"
              link
              type="primary"
              @click="openEdit(row as ScreenItem)"
            >
              {{ t("dataScreen.edit") }}
            </el-button>
            <el-button
              v-if="canDestroy"
              link
              type="danger"
              @click="remove(row as ScreenItem)"
            >
              {{ t("dataScreen.delete") }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialog"
      :title="editingPk ? t('dataScreen.edit') : t('dataScreen.create')"
      width="520px"
    >
      <el-form label-width="100px">
        <el-form-item :label="t('dataScreen.name')" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item :label="t('dataScreen.dashboards')" required>
          <el-select
            v-model="form.dashboards"
            class="w-full"
            multiple
            filterable
          >
            <el-option
              v-for="item in dashboards"
              :key="item.pk"
              :value="item.pk"
              :label="item.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('dataScreen.interval')">
          <el-input-number v-model="form.interval" :min="5" :max="3600" />
        </el-form-item>
        <el-form-item :label="t('dataScreen.refresh')">
          <el-input-number v-model="form.refresh" :min="10" :max="3600" />
        </el-form-item>
        <el-form-item :label="t('dataScreen.visibilityLabel')">
          <el-radio-group v-model="form.visibility">
            <el-radio value="personal">{{ t("dataScreen.personal") }}</el-radio>
            <el-radio value="shared">{{ t("dataScreen.shared") }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">{{
          t("dataScreen.cancel")
        }}</el-button>
        <el-button type="primary" @click="submit">{{
          t("dataScreen.confirm")
        }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>
