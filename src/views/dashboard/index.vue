<script lang="ts" setup>
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { ArrowDown, ArrowUp, Download, Setting } from "@element-plus/icons-vue";
import ReEmpty from "@/components/ReEmpty";
import { hasAuth } from "@/router/utils";
import type { DashboardItem } from "@/api/dataset/datasets";
import {
  AUTO_REFRESH_OPTIONS,
  useDashboardAutoRefresh
} from "./utils/useDashboardAutoRefresh";
import { useCardImageExport } from "./utils/useCardImageExport";
import { useCardDialog } from "./utils/useCardDialog";
import { useDashboardDialogs } from "./utils/useDashboardDialogs";
import { useDashboardDelete } from "./utils/useDashboardDelete";
import { useDashboardEditing } from "./utils/useDashboardEditing";
import { useDashboardView } from "./utils/useDashboardView";
import { cardColSpan, cardColSpanNarrow } from "./utils/span";
import { cardRenderHeight } from "@/utils/cardHeight";
// 门控包装：内部等 echarts 就绪后再挂载 ChartCard（useECharts 初始化时同步读 $echarts）
import { ChartCardAsync as ChartCard } from "./components/ChartCardAsync";

defineOptions({
  name: "DataDashboard"
});

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const canEdit = hasAuth("partialUpdate:DataDashboard");
const canCreate = hasAuth("create:DataDashboard");
const canDestroy = hasAuth("destroy:DataDashboard");
/** 展板路由（meta.kiosk）：隐藏全部编辑/选择工具栏，只读自动刷新 */
const kiosk = computed(() => route.meta?.kiosk === true);

// ---- 展示态（清单/选中/分享/数据集目录/刷新信号）与编辑态（草稿/拖拽/保存）各归 composable ----
const view = useDashboardView({ t, route, router });
const {
  current,
  dashboards,
  datasetName,
  datasets,
  loadDashboards,
  loadDatasets,
  loading,
  refreshCards,
  refreshKey,
  selectDashboard,
  setSwitchGuard,
  shareDashboard
} = view;

const {
  editing,
  layout,
  layoutKey,
  moveCard,
  removeCard,
  rowRef,
  saveLayout,
  saving,
  stopEditing,
  toggleEdit,
  updateDraft
} = useDashboardEditing({ t, current, dashboards });
// 切换仪表盘先退出编辑（未保存草稿随之放弃），与「保存才提交」的草稿语义一致
setSwitchGuard(stopEditing);

/* ---------------- 自动刷新（挂屏轮看场景）：间隔选择 + 定时 bump refreshKey ---------------- */
const { seconds: autoRefreshSeconds } = useDashboardAutoRefresh({
  kiosk,
  requestedSeconds: route.query.refresh,
  refresh: refreshCards
});

/** 卡片图片导出（composable：句柄收集 + 单卡导出，控制页面体积） */
const { setCardRef, exportingCard, exportCardImage } = useCardImageExport(t);

// ---- 卡片弹窗（新建 / 编辑双模式）与图片导出：独立 composable（控制页面体积） ----
const { openCardSettings, openCardDialog } = useCardDialog({
  t,
  datasets,
  updateDraft
});

// ---- 新建 / 设置仪表盘弹窗：独立 composable（控制页面体积） ----
const { openCreateDashboard, openDashboardSettings } = useDashboardDialogs({
  t,
  dashboards,
  current,
  reload: loadDashboards,
  syncQuery: view.syncDashboardQuery
});

const { removeDashboard } = useDashboardDelete({
  current,
  reload: loadDashboards,
  syncQuery: view.syncDashboardQuery
});

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
  <div v-loading="loading">
    <!-- 与列表页内容区同宽：页面留白由 layout 的 main-content 统一提供，
         不再用 pr-[1%] 模拟 RePlusPage 搜索卡的 1% 右留白；
         根元素自带 layout 注入的 main-content（24px 外边距），不能再设百分比宽度（会溢出） -->
    <el-card v-if="!kiosk" shadow="never" class="mb-3">
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
          v-if="canEdit && current && current.is_owner !== false"
          :type="editing ? 'warning' : 'primary'"
          @click="toggleEdit"
        >
          {{ editing ? t("dashboard.cancelEdit") : t("dashboard.edit") }}
        </el-button>
        <el-button
          v-if="editing"
          type="success"
          :loading="saving"
          @click="saveLayout"
        >
          {{ t("dashboard.saveLayout") }}
        </el-button>
        <el-button
          v-if="editing && canDestroy"
          type="danger"
          plain
          @click="removeDashboard"
        >
          {{ t("dashboard.remove") }}
        </el-button>
        <el-button
          v-if="canEdit && current && current.is_owner !== false && !editing"
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
            :style="{ height: `${cardRenderHeight(card.height)}px` }"
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
                  :icon="ArrowUp"
                  :title="t('dashboard.moveUp')"
                  :aria-label="t('dashboard.moveUp')"
                  @click="moveCard(card.id, -1)"
                />
                <el-button
                  v-if="editing"
                  link
                  type="primary"
                  :icon="ArrowDown"
                  :title="t('dashboard.moveDown')"
                  :aria-label="t('dashboard.moveDown')"
                  @click="moveCard(card.id, 1)"
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
              :key="`${layoutKey}-${card.id}`"
              :ref="setCardRef(card.id)"
              :card="card"
              :refresh-token="refreshKey"
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
  transition: color var(--duration-fast) var(--ease-standard);

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
