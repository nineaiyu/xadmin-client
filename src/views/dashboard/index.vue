<script lang="ts" setup>
import { computed, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import ReEmpty from "@/components/ReEmpty";
import { hasAuth } from "@/router/utils";
import type { DashboardCard } from "@/api/dataset/datasets";
import { useDashboardAutoRefresh } from "./utils/useDashboardAutoRefresh";
import { useCardImageExport } from "./utils/useCardImageExport";
import { useDashboardSnapshot } from "./utils/useDashboardSnapshot";
import { useCardDialog } from "./utils/useCardDialog";
import { useDashboardDialogs } from "./utils/useDashboardDialogs";
import { useDashboardDelete } from "./utils/useDashboardDelete";
import { useDashboardEditing } from "./utils/useDashboardEditing";
import { useDashboardView } from "./utils/useDashboardView";
import { useCardDrill } from "./utils/useCardDrill";
import { useDashboardLinkage } from "./utils/useDashboardLinkage";
import { cardColSpan, cardColSpanNarrow } from "./utils/span";
import { cardRenderHeight } from "@/utils/cardHeight";
import { syncSelectInputsA11y } from "@/utils/tableA11y";
// 门控包装：内部等 echarts 就绪后再挂载 ChartCard（useECharts 初始化时同步读 $echarts）
import { ChartCardAsync as ChartCard } from "./components/ChartCardAsync";
import CardDrillDrawer from "./components/CardDrillDrawer.vue";
import CardHeaderActions from "./components/CardHeaderActions.vue";
import DashboardToolbar from "./components/DashboardToolbar.vue";

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
const { cardRefs, setCardRef, exportingCard, exportCardImage } =
  useCardImageExport(t);

/** 快照导出：整盘卡片按页面布局合成单张 PNG（标题/时间戳/水印叠加） */
const { exporting: exportingSnapshot, exportDashboardSnapshot } =
  useDashboardSnapshot({
    layout,
    current,
    cardRefs,
    rowEl: () => (rowRef.value?.$el as HTMLElement | undefined) ?? null
  });

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

/* ---------------- 卡片下钻：图表点击 / 查看明细 → 数据集明细抽屉 ---------------- */
const { drillVisible, drillCard, openDrill, drillFilter } = useCardDrill();

/* ---------------- 卡片联动：点击维度值反向过滤同盘其他卡片（来源卡除外） ---------------- */
const {
  linkage,
  applyFromPoint,
  clear: clearLinkage,
  payloadFor
} = useDashboardLinkage({
  datasets
});

/** 卡片点击：下钻抽屉 + 同步联动（带维度原值时）；联动变化即整盘刷新 */
const onCardPoint = (
  card: DashboardCard,
  point: { name: string; raw?: unknown } | null
) => {
  openDrill(card, point);
  if (applyFromPoint(card, point)) refreshCards();
};

/** 清除联动并复位到全量视图（chip 关闭按钮） */
const onClearLinkage = () => {
  clearLinkage();
  refreshCards();
};

// 编辑态预览不受浏览态过滤影响；切换仪表盘联动复位（卡片属于另一份布局）
watch(editing, value => {
  if (value) clearLinkage();
});
watch(
  () => current.value?.pk,
  () => clearLinkage()
);

onMounted(async () => {
  await Promise.all([loadDashboards(), loadDatasets()]);
  // 自动刷新下拉的可访问名（EP el-select 无 props 入口，渲染后补名；
  // 与分页器下拉同一收口手法）
  syncSelectInputsA11y(
    document.querySelector('[data-testid="dashboard-picker"]'),
    t("dashboard.pickDashboard")
  );
  syncSelectInputsA11y(
    document.querySelector('[data-testid="dashboard-auto-refresh"]'),
    t("dashboard.autoRefresh")
  );
});
</script>

<template>
  <div v-loading="loading">
    <!-- 与列表页内容区同宽：页面留白由 layout 的 main-content 统一提供，
         不再用 pr-[1%] 模拟 RePlusPage 搜索卡的 1% 右留白；
         根元素自带 layout 注入的 main-content（24px 外边距），不能再设百分比宽度（会溢出） -->
    <DashboardToolbar
      v-if="!kiosk"
      v-model:auto-refresh-seconds="autoRefreshSeconds"
      :can-edit="canEdit"
      :can-create="canCreate"
      :can-destroy="canDestroy"
      :current="current"
      :dashboards="dashboards"
      :editing="editing"
      :saving="saving"
      :exporting-snapshot="exportingSnapshot"
      @select="selectDashboard"
      @create="openCreateDashboard"
      @toggle-edit="toggleEdit"
      @save="saveLayout"
      @remove="removeDashboard"
      @settings="openDashboardSettings"
      @export-snapshot="exportDashboardSnapshot"
      @share="shareDashboard"
      @refresh="refreshCards"
      @go-datasets="goDatasetPage"
    />

    <ReEmpty
      v-if="!current"
      :description="t('dashboard.empty')"
      icon="ep/data-line"
    />
    <template v-else>
      <!-- 联动过滤提示条：当前联动来源卡与维度值，可一键清除回到全量 -->
      <div
        v-if="linkage && !editing"
        class="mb-3"
        data-testid="dashboard-linkage-bar"
      >
        <el-tag
          closable
          type="primary"
          size="large"
          :title="t('dashboard.linkageTip')"
          data-testid="dashboard-linkage-chip"
          @close="onClearLinkage"
        >
          {{
            t("dashboard.linkageActive", {
              name: linkage.sourceTitle,
              value: linkage.label
            })
          }}
        </el-tag>
      </div>
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
            :data-card-id="card.id"
            :style="{ height: `${cardRenderHeight(card.height)}px` }"
            :body-style="{ flex: '1 1 0%', minHeight: '0' }"
          >
            <template #header>
              <div class="flex items-center gap-2">
                <!-- 拖拽手柄留在标题左侧（sortable 的 handle 选择器按卡片头定位） -->
                <span v-if="editing" class="drag-handle" aria-hidden="true" />
                <span class="truncate font-medium">{{ card.title }}</span>
                <el-tag size="small" type="info" class="card-dataset-tag ml-1">
                  {{ datasetName(card.dataset) }}
                </el-tag>
                <div class="flex-1" />
                <CardHeaderActions
                  :editing="editing"
                  :exporting="exportingCard === card.id"
                  @export-image="exportCardImage(card)"
                  @drill="openDrill(card, null)"
                  @move="direction => moveCard(card.id, direction)"
                  @settings="openCardSettings(card)"
                  @remove="removeCard(card.id)"
                />
              </div>
            </template>
            <ChartCard
              :key="`${layoutKey}-${card.id}`"
              :ref="setCardRef(card.id)"
              :card="card"
              :refresh-token="refreshKey"
              :drillable="!editing"
              :linkage-filter="payloadFor(card)"
              @drill="point => onCardPoint(card, point)"
            />
          </el-card>
        </el-col>
      </el-row>
      <el-button v-if="editing" class="w-40!" @click="openCardDialog">
        {{ t("dashboard.addCard") }}
      </el-button>
    </template>

    <CardDrillDrawer
      v-model="drillVisible"
      :title="String(drillCard?.title ?? '')"
      :dataset="drillCard?.dataset ?? ''"
      :filter="drillFilter"
    />
  </div>
</template>

<style lang="scss" scoped>
/* 卡片头「数据集名」标签：el-tag--info 缺省文字色在浅灰底上对比度不足
   （axe color-contrast serious），正文灰加深一档（底色不变，视觉近似） */
.card-dataset-tag :deep(.el-tag__content) {
  color: var(--el-text-color-regular);
}

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
