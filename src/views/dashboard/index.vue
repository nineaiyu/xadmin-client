<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { computed, h, onMounted, ref } from "vue";
import Sortable from "sortablejs";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { Download, Setting } from "@element-plus/icons-vue";
import { ElMessageBox } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import {
  dashboardApi,
  datasetApi,
  listRows,
  type DashboardCard,
  type DashboardItem,
  type DatasetItem
} from "@/api/system/datasets";
import { useCardImageExport } from "./utils/useCardImageExport";
import { useCardDialog } from "./utils/useCardDialog";
import { cardColSpan, cardColSpanNarrow } from "./utils/span";
import ChartCard from "./components/ChartCard.vue";
import DashboardCreateForm from "./components/DashboardCreateForm.vue";

defineOptions({
  name: "DataDashboard"
});

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const canEdit = hasAuth("partialUpdate:DataDashboard");
const canCreate = hasAuth("create:DataDashboard");

const dashboards = ref<DashboardItem[]>([]);
const current = ref<DashboardItem | null>(null);
const loading = ref(false);
const editing = ref(false);
/** 卡片刷新计数：自增触发卡片重挂载并重新拉数（手动刷新入口） */
const refreshKey = ref(0);

const refreshCards = () => {
  refreshKey.value += 1;
};

const layout = computed<DashboardCard[]>(() =>
  editing.value ? draftLayout.value : (current.value?.layout ?? [])
);

/** 编辑态草稿：拖拽排序/增删卡片落在草稿上，保存才提交后端 */
const draftLayout = ref<DashboardCard[]>([]);
const layoutKey = computed(() =>
  draftLayout.value.map(card => card.id).join("|")
);

let sortable: Sortable | null = null;
const rowRef = ref();

/** U-5 卡片图片导出（composable：句柄收集 + 单卡导出，控制页面体积） */
const { setCardRef, exportingCard, exportCardImage } = useCardImageExport(t);

const loadDashboards = async () => {
  loading.value = true;
  try {
    const res = await dashboardApi.list();
    dashboards.value = listRows<DashboardItem>(res as never);
    if (!current.value && dashboards.value.length > 0) {
      // 分享链接定位：?pk=<仪表盘主键> 命中则直接打开对应仪表盘
      const sharedPk = typeof route.query.pk === "string" ? route.query.pk : "";
      current.value =
        dashboards.value.find(item => item.pk === sharedPk) ??
        dashboards.value[0];
    }
  } finally {
    loading.value = false;
  }
};

const datasets = ref<DatasetItem[]>([]);
const loadDatasets = async () => {
  const res = await fetchAllRows(datasetApi.list);
  datasets.value = listRows<DatasetItem>(res as never);
};

/** 选中仪表盘并把 pk 写回地址栏（分享即复制当前 URL） */
const selectDashboard = (pk: string) => {
  current.value = dashboards.value.find(item => item.pk === pk) ?? null;
  editing.value = false;
  syncDashboardQuery();
};

const syncDashboardQuery = () => {
  if (!current.value) return;
  router.replace({ query: { ...route.query, pk: current.value.pk } });
};

/** 复制当前仪表盘视图链接（同角色内有权限者打开即定位到该仪表盘） */
const shareDashboard = async () => {
  if (!current.value) return;
  syncDashboardQuery();
  try {
    await navigator.clipboard.writeText(window.location.href);
    message(t("dashboard.shareCopied"), { type: "success" });
  } catch {
    // 剪贴板不可用（非 https/权限受限）时直接展示链接供手动复制
    message(String(window.location.href), { type: "info", duration: 5000 });
  }
};

const toggleEdit = () => {
  if (!current.value) return;
  if (!editing.value) {
    draftLayout.value = JSON.parse(JSON.stringify(current.value.layout ?? []));
    editing.value = true;
    setupSortable();
  } else {
    editing.value = false;
    destroySortable();
  }
};

const destroySortable = () => {
  sortable?.destroy();
  sortable = null;
};

const setupSortable = () => {
  destroySortable();
  if (!rowRef.value?.$el) return;
  sortable = Sortable.create(rowRef.value.$el, {
    animation: 200,
    handle: ".drag-handle",
    onEnd: ({ oldIndex, newIndex }) => {
      if (
        oldIndex === undefined ||
        newIndex === undefined ||
        oldIndex === newIndex
      )
        return;
      const next = [...draftLayout.value];
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);
      draftLayout.value = next;
    }
  });
};

const saveLayout = async () => {
  if (!current.value) return;
  const res = await dashboardApi.partialUpdate(current.value.pk, {
    layout: draftLayout.value
  });
  if (res.code === SUCCESS_CODE) {
    message(t("dashboard.saveOk"), { type: "success" });
    const index = dashboards.value.findIndex(
      item => item.pk === current.value?.pk
    );
    if (index >= 0 && (res.data as unknown as DashboardItem)) {
      dashboards.value[index] = res.data as unknown as DashboardItem;
      current.value = dashboards.value[index];
    }
    editing.value = false;
    destroySortable();
    return;
  }
  // 200 + 业务码非 1000：全局拦截器只处理 HTTP 层错误，业务失败必须显式提示
  if (res.detail) message(String(res.detail), { type: "error" });
};

const removeCard = (id: string) => {
  draftLayout.value = draftLayout.value.filter(card => card.id !== id);
};

const datasetName = (pk: string) =>
  datasets.value.find(item => item.pk === pk)?.name ?? pk;

// ---- 卡片弹窗（新建 / 编辑双模式）与图片导出：独立 composable（控制页面体积） ----
const { openCardSettings, openCardDialog } = useCardDialog({
  t,
  datasets,
  updateDraft: updater => {
    draftLayout.value = updater(draftLayout.value);
  }
});

// ---- 新建仪表盘弹窗 ----
const dashFormRef = ref<InstanceType<typeof DashboardCreateForm>>();

const openCreateDashboard = () => {
  dashFormRef.value = undefined;
  addDialog({
    title: t("dashboard.create"),
    width: dialogSize("sm"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    sureBtnLoading: true,
    contentRenderer: () => h(DashboardCreateForm, { ref: dashFormRef }),
    beforeSure: async (done, { closeLoading }) => {
      const payload = dashFormRef.value?.getPayload();
      if (!payload) {
        closeLoading();
        return;
      }
      // 异常归一为可读失败结果：避免请求异常时 beforeSure 抛错、弹窗 loading 悬挂
      const res = await dashboardApi
        .create({ ...payload, layout: [] })
        .catch(error => ({
          code: -1,
          data: null,
          detail: String((error as { detail?: string })?.detail ?? error)
        }));
      if (res.code === SUCCESS_CODE) {
        message(t("dashboard.saveOk"), { type: "success" });
        // 先关弹窗再刷新列表（与原手写弹窗行为一致，避免刷新耗时导致弹窗滞留）
        done();
        current.value = null;
        await loadDashboards();
        current.value =
          dashboards.value.find(
            item => item.pk === (res.data as never as DashboardItem)?.pk
          ) ?? null;
        syncDashboardQuery();
        return;
      }
      // 200 + 业务码非 1000：全局拦截器只处理 HTTP 层错误，业务失败必须显式提示
      if (res.detail) message(String(res.detail), { type: "error" });
      closeLoading();
    }
  });
};

// ---- 仪表盘设置弹窗（重命名 / 可见性；与新建表单同构） ----
const dashSettingsRef = ref<InstanceType<typeof DashboardCreateForm>>();

const openDashboardSettings = () => {
  if (!current.value) return;
  const editingPk = current.value.pk;
  dashSettingsRef.value = undefined;
  addDialog({
    title: t("dashboard.settings"),
    width: dialogSize("sm"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    sureBtnLoading: true,
    contentRenderer: () =>
      h(DashboardCreateForm, { ref: dashSettingsRef, row: current.value }),
    beforeSure: async (done, { closeLoading }) => {
      const payload = dashSettingsRef.value?.getPayload();
      if (!payload) {
        closeLoading();
        return;
      }
      const res = await dashboardApi
        .partialUpdate(editingPk, payload)
        .catch(error => ({
          code: -1,
          data: null,
          detail: String((error as { detail?: string })?.detail ?? error)
        }));
      if (res.code === SUCCESS_CODE) {
        message(t("dashboard.saveOk"), { type: "success" });
        done();
        const index = dashboards.value.findIndex(item => item.pk === editingPk);
        if (index >= 0 && res.data) {
          dashboards.value[index] = res.data as unknown as DashboardItem;
          current.value = dashboards.value[index];
        }
        return;
      }
      if (res.detail) message(String(res.detail), { type: "error" });
      closeLoading();
    }
  });
};

const removeDashboard = async () => {
  if (!current.value) return;
  try {
    await ElMessageBox.confirm(
      t("dashboard.removeConfirm", { name: current.value.name }),
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
  const res = await dashboardApi.destroy(current.value.pk);
  if (res.code === SUCCESS_CODE) {
    current.value = null;
    await loadDashboards();
    syncDashboardQuery();
  }
};

const goDatasetPage = () => {
  router.push("/analysis/dataset/index");
};

onMounted(async () => {
  await Promise.all([loadDashboards(), loadDatasets()]);
});
</script>

<template>
  <div v-loading="loading" class="pr-[1%]">
    <!-- pr-[1%]：内容宽度对齐 RePlusPage 的 w-99/100（右侧留 1%），
         根元素自带 layout 注入的 main-content（24px 外边距），不能再设百分比宽度（会溢出） -->
    <el-card shadow="never" class="mb-3">
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-semibold">{{ t("dashboard.title") }}</span>
        <el-select
          v-model="current"
          :placeholder="t('dashboard.pickDashboard')"
          value-key="pk"
          class="w-56!"
          @change="(item: DashboardItem) => selectDashboard(item?.pk)"
        >
          <el-option
            v-for="item in dashboards"
            :key="item.pk"
            :value="item"
            :label="item.name"
          />
        </el-select>
        <el-button
          v-if="canCreate"
          data-testid="dashboard-create"
          @click="openCreateDashboard"
        >
          {{ t("dashboard.create") }}
        </el-button>
        <el-button
          v-if="canEdit && current"
          :type="editing ? 'warning' : 'primary'"
          @click="toggleEdit"
        >
          {{ editing ? t("dashboard.cancelEdit") : t("dashboard.edit") }}
        </el-button>
        <el-button v-if="editing" type="success" @click="saveLayout">
          {{ t("dashboard.saveLayout") }}
        </el-button>
        <el-button v-if="editing" type="danger" plain @click="removeDashboard">
          {{ t("dashboard.remove") }}
        </el-button>
        <el-button
          v-if="canEdit && current && !editing"
          plain
          data-testid="dashboard-settings"
          @click="openDashboardSettings"
        >
          {{ t("dashboard.settings") }}
        </el-button>
        <div class="flex-1" />
        <el-button
          v-if="current"
          link
          type="primary"
          data-testid="dashboard-share"
          @click="shareDashboard"
        >
          {{ t("dashboard.share") }}
        </el-button>
        <el-button
          v-if="current"
          link
          type="primary"
          data-testid="dashboard-refresh"
          @click="refreshCards"
        >
          {{ t("dashboard.refresh") }}
        </el-button>
        <el-button link type="primary" @click="goDatasetPage">
          {{ t("dashboard.manageDatasets") }}
        </el-button>
      </div>
    </el-card>

    <el-empty v-if="!current" :description="t('dashboard.empty')" />
    <template v-else>
      <el-row ref="rowRef" :gutter="12" data-testid="dashboard-cards">
        <!-- 栅格：窄屏最多两列（xs 全宽 / sm、md 半宽上限）；lg 起回到用户档位。
             EP 断点类为 min-width 语义，必须显式给 lg，否则大屏仍命中 md 的半宽值 -->
        <el-col
          v-for="card in layout"
          :key="card.id"
          :span="cardColSpan(card)"
          :xs="24"
          :sm="cardColSpanNarrow(card)"
          :md="cardColSpanNarrow(card)"
          :lg="cardColSpan(card)"
          class="mb-3"
        >
          <el-card
            shadow="hover"
            class="flex flex-col overflow-hidden"
            :style="{ height: `${card.height ?? 224}px` }"
            :body-style="{ flex: '1 1 0%', minHeight: '0' }"
          >
            <template #header>
              <div class="flex items-center gap-2">
                <el-icon v-if="editing" class="drag-handle cursor-move">
                  <span>⋮⋮</span>
                </el-icon>
                <span class="truncate font-medium">{{ card.title }}</span>
                <el-tag size="small" type="info" class="ml-1">
                  {{ datasetName(card.dataset) }}
                </el-tag>
                <div class="flex-1" />
                <el-button
                  v-if="!editing"
                  link
                  type="primary"
                  :icon="Download"
                  :title="t('dashboard.exportImage')"
                  :loading="exportingCard === card.id"
                  data-testid="card-export-image"
                  @click="exportCardImage(card)"
                />
                <el-button
                  v-if="editing"
                  link
                  type="primary"
                  :icon="Setting"
                  :title="t('dashboard.cardSettings')"
                  @click="openCardSettings(card)"
                />
                <el-button
                  v-if="editing"
                  link
                  type="danger"
                  @click="removeCard(card.id)"
                >
                  {{ t("dashboard.remove") }}
                </el-button>
              </div>
            </template>
            <ChartCard
              :key="`${layoutKey}-${card.id}-${refreshKey}`"
              :ref="setCardRef(card.id)"
              :card="card"
            />
          </el-card>
        </el-col>
      </el-row>
      <el-button v-if="editing" class="w-40!" @click="openCardDialog">
        {{ t("dashboard.addCard") }}
      </el-button>
    </template>
  </div>
</template>
