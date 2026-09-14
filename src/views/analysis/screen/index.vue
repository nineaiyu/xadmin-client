<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { h, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { ElMessageBox } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import {
  listRows,
  listDashboards,
  screenApi,
  type ScreenItem
} from "@/api/system/analysis";
import { choiceValue } from "@/utils/dict";
import ScreenForm from "./components/ScreenForm.vue";

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

/** 新建 / 编辑弹窗（C5：统一走 ReDialog，表单在 ScreenForm 中） */
const formRef = ref<InstanceType<typeof ScreenForm>>();

const openDialog = (row: ScreenItem | null) => {
  formRef.value = undefined;
  addDialog({
    title: row ? t("dataScreen.edit") : t("dataScreen.create"),
    width: dialogSize("md"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    sureBtnLoading: true,
    contentRenderer: () =>
      h(ScreenForm, { ref: formRef, row, dashboards: dashboards.value }),
    beforeSure: async (done, { closeLoading }) => {
      const payload = formRef.value?.getPayload();
      if (!payload) {
        closeLoading();
        return;
      }
      const res = row
        ? await screenApi.partialUpdate(row.pk, payload)
        : await screenApi.create(payload);
      if (res.code === SUCCESS_CODE) {
        message(t("dataScreen.saveOk"), { type: "success" });
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
const openEdit = (row: ScreenItem) => openDialog(row);

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
  </div>
</template>
