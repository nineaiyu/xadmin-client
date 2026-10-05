<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Sortable from "sortablejs";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { Download, Setting } from "@element-plus/icons-vue";
import ReEmpty from "@/components/ReEmpty";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { copyText } from "@/utils/clipboard";
import { useConfirm } from "@/hooks/useConfirm";
import {
  dashboardApi,
  datasetApi,
  listRows,
  type DashboardCard,
  type DashboardItem,
  type DatasetItem
} from "@/api/dataset/datasets";
import { useCardImageExport } from "./utils/useCardImageExport";
import { useCardDialog } from "./utils/useCardDialog";
import { useDashboardDialogs } from "./utils/useDashboardDialogs";
import { cardColSpan, cardColSpanNarrow } from "./utils/span";
import ChartCard from "./components/ChartCard.vue";

defineOptions({
  name: "DataDashboard"
});

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const confirm = useConfirm();
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

/* ---------------- 自动刷新（挂屏轮看场景）：间隔选择 + 定时 bump refreshKey ---------------- */
const AUTO_REFRESH_OPTIONS = [
  { value: 0, labelKey: "dashboard.autoRefreshOff" },
  { value: 10, labelKey: "dashboard.autoRefresh10s" },
  { value: 30, labelKey: "dashboard.autoRefresh30s" },
  { value: 60, labelKey: "dashboard.autoRefresh60s" },
  { value: 300, labelKey: "dashboard.autoRefresh5m" }
];
const autoRefreshSeconds = ref(0);
let autoRefreshTimer: number | undefined;

const stopAutoRefresh = () => {
  if (autoRefreshTimer) {
    window.clearInterval(autoRefreshTimer);
    autoRefreshTimer = undefined;
  }
};

watch(autoRefreshSeconds, seconds => {
  stopAutoRefresh();
  if (seconds > 0) {
    autoRefreshTimer = window.setInterval(refreshCards, seconds * 1000);
  }
});

onBeforeUnmount(stopAutoRefresh);

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

/** 卡片图片导出（composable：句柄收集 + 单卡导出，控制页面体积） */
const { setCardRef, exportingCard, exportCardImage } = useCardImageExport(t);

const loadDashboards = async () => {
  loading.value = true;
  try {
    // fetchAllRows：下拉与 ?pk= 分享定位必须覆盖全量仪表盘——只取首页 20 条
    // 会让超出分页的仪表盘在下拉里缺失、分享定位静默回落（与 loadDatasets 同口径）
    const res = await fetchAllRows(dashboardApi.list);
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
  // 剪贴板不可用（非 https/权限受限）时降级展示链接供手动复制
  await copyText(window.location.href, {
    failureFallbackText: String(window.location.href)
  });
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
  const res = await dashboardApi.partialUpdate<DashboardItem>(
    current.value.pk,
    { layout: draftLayout.value }
  );
  if (res.code === SUCCESS_CODE) {
    message(t("dashboard.saveOk"), { type: "success" });
    const index = dashboards.value.findIndex(
      item => item.pk === current.value?.pk
    );
    if (index >= 0 && res.data) {
      dashboards.value[index] = res.data;
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

// ---- 新建 / 设置仪表盘弹窗：独立 composable（控制页面体积） ----
const { openCreateDashboard, openDashboardSettings } = useDashboardDialogs({
  t,
  dashboards,
  current,
  reload: loadDashboards,
  syncQuery: syncDashboardQuery
});

const removeDashboard = async () => {
  if (!current.value) return;
  if (
    !(await confirm(
      t("dashboard.removeConfirm", { name: current.value.name }),
      {
        confirmButtonClass: "el-button--danger",
        draggable: true
      }
    ))
  ) {
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
  // 护栏：URL 命名空间 /analysis/dataset/index ≠ 组件目录
  // views/dashboard/dataset/，靠 menu.json 种子（DataDataset）的显式映射存活，
  // 线上库菜单行已按该 path 落库。口径结论：保留映射，勿"顺手修齐"（改 URL 或
  // 移目录都会断链）；详见 xadmin-server/docs/guide/menu-maintenance.md
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
        <el-select
          v-model="autoRefreshSeconds"
          class="w-28!"
          size="default"
          data-testid="dashboard-auto-refresh"
          :title="t('dashboard.autoRefreshTip')"
        >
          <el-option
            v-for="item in AUTO_REFRESH_OPTIONS"
            :key="item.value"
            :value="item.value"
            :label="t(item.labelKey)"
          />
        </el-select>
        <el-button link type="primary" @click="goDatasetPage">
          {{ t("dashboard.manageDatasets") }}
        </el-button>
      </div>
    </el-card>

    <ReEmpty
      v-if="!current"
      :description="t('dashboard.empty')"
      icon="ep/data-line"
    />
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
            shadow="never"
            class="app-card flex flex-col overflow-hidden"
            :style="{ height: `${card.height ?? 224}px` }"
            :body-style="{ flex: '1 1 0%', minHeight: '0' }"
          >
            <template #header>
              <div class="flex items-center gap-2">
                <span v-if="editing" class="drag-handle" aria-hidden="true" />
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

<style lang="scss" scoped>
/* 卡片拖拽手柄：2×3 点阵（CSS 绘制，避免文本字符在不同字体下的宽度差异） */
.drag-handle {
  display: block;
  width: 10px;
  height: 16px;
  color: var(--el-text-color-placeholder);
  cursor: move;
  transition: color var(--el-transition-duration);

  &::before {
    display: block;
    width: 4px;
    height: 4px;
    content: "";
    background: currentcolor;
    border-radius: 50%;
    box-shadow:
      0 6px 0 currentcolor,
      0 12px 0 currentcolor,
      6px 0 0 currentcolor,
      6px 6px 0 currentcolor,
      6px 12px 0 currentcolor;
  }

  &:hover {
    color: var(--el-color-primary);
  }
}
</style>
