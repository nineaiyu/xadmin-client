<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { screenApi, type ScreenItem } from "@/api/dataset/analysis";
import {
  dashboardApi,
  datasetApi,
  listRows,
  type DashboardCard,
  type DashboardItem,
  type DatasetItem
} from "@/api/dataset/datasets";
import { useI18n } from "vue-i18n";
import type { ScreenDataPayload } from "@/utils/websocket/protocol";
// 仅类型引用（不进包）：导出实现按需动态加载（保持首屏体积）
import type { ExportedImage } from "@/utils/imageExport";
import { useScreenDisplay } from "./utils/useScreenDisplay";
import { useScreenExport } from "./utils/useScreenExport";
import { canvasGridVars } from "./utils/layout";
import ChartCard from "@/views/dashboard/components/ChartCard.vue";
import ScreenPane from "./components/ScreenPane.vue";
import ReEmpty from "@/components/ReEmpty";
import PauseIcon from "~icons/ep/video-pause";
import PlayIcon from "~icons/ep/video-play";
import FullscreenIcon from "~icons/ep/full-screen";
import DownloadIcon from "~icons/ep/download";

defineOptions({
  name: "DataScreenDisplay"
});

/**
 * 大屏投屏：全屏轮播 Screen 内的仪表盘，按 refresh 秒自动重拉数据。
 * 权限复用仪表盘可见性：对当前浏览者不可见的仪表盘自动跳过。
 * 图表渲染复用一期的 ChartCard（defineExpose loadData 供定时刷新）。
 *
 * 远程控制：连接 ws/screen/<pk> 接收管理端指令（切换/翻页/刷新/恢复轮播）；
 * manual 态停本地轮播并停在远程指定页，auto 态恢复轮播。控制帧按
 * 「服务端 dashboards 下标 → 本地可见列表」映射，跳过不可见仪表盘不会错位。
 */

const route = useRoute();
const { t } = useI18n();

const screen = ref<ScreenItem | null>(null);
const dashboards = ref<DashboardItem[]>([]);
/** 可见数据集（服务端按浏览者过滤）：指标卡窗格按此口径过滤，与仪表盘窗格一致 */
const datasets = ref<DatasetItem[]>([]);

/** 卡片组件句柄：模板 ref 收集 ChartCard（loadData 刷新 + applyData 注入 + renderImage 图片导出） */
type CardHandle = {
  loadData?: () => void;
  applyData?: (_entry: CardDataEntry) => Promise<void> | void;
  renderImage?: () => Promise<ExportedImage | null>;
};
const cardRefs = ref<Record<string, CardHandle | undefined>>({});
const setCardRef = (cardId: string) => (el: unknown) => {
  const handle = el as CardHandle | null;
  if (handle) cardRefs.value[cardId] = handle;
};

/** screen_data 帧的卡片级条目（cards[] 原样 / errors[] 转错误提示口径） */
type CardDataEntry = {
  card: string;
  kind?: string;
  data?: unknown;
  detail?: string;
};
type ApplyScreenData = (_frame: ScreenDataPayload) => void;
const toErrorEntry = (error: {
  card: string;
  detail: string;
}): CardDataEntry => ({
  card: error.card,
  detail: error.detail
});

/**
 * 画布模式（P2.2 批次一）：`layout` 非空即按窗格渲染，空则维持既有仪表盘轮播。
 * 与轮播同一可见性口径：窗格引用的仪表盘 / 数据集对浏览者不可见时整格跳过
 * （后端口径同 `can_view_screen` + 执行侧 fail-closed，前端只做展示层过滤）。
 */
const layoutPanes = computed(() =>
  (screen.value?.layout ?? []).filter(
    pane =>
      (pane.type !== "dashboard" ||
        dashboards.value.some(item => item.pk === pane.dashboard)) &&
      (pane.type !== "metric" ||
        datasets.value.some(item => item.pk === pane.dataset))
  )
);
const isCanvas = computed(() => layoutPanes.value.length > 0);
const paneCards = (pane: { dashboard?: string }) =>
  dashboards.value.find(item => item.pk === pane.dashboard)?.layout ?? [];
const paneTitle = (pane: { dashboard?: string }) =>
  dashboards.value.find(item => item.pk === pane.dashboard)?.name ?? "";

/** 画布模式下的窗格句柄（刷新与导出共用同一接口，实现见 ScreenPane） */
const paneRefs = ref<Record<string, InstanceType<typeof ScreenPane> | null>>(
  {}
);
const setPaneRef = (pk: string) => (el: unknown) => {
  paneRefs.value[pk] = el as InstanceType<typeof ScreenPane> | null;
};

const refreshVisible = () => {
  if (isCanvas.value) {
    Object.values(paneRefs.value).forEach(handle => handle?.refresh?.());
    return;
  }
  for (const card of currentCards.value) {
    cardRefs.value[card.id]?.loadData?.();
  }
};

/**
 * 应用服务端聚合数据帧（screen_data，F2）：按 card id 免拉直渲。
 * 轮播模式帧按仪表盘分发（dashboard 与当前页不一致的帧不应用——其卡片未渲染）；
 * 画布模式单帧 dashboard=null，逐窗格路由（窗格持有该卡才应用）。
 */
const applyScreenData: ApplyScreenData = frame => {
  if (isCanvas.value) {
    for (const entry of [...frame.cards, ...frame.errors.map(toErrorEntry)]) {
      Object.values(paneRefs.value).some(handle =>
        handle?.applyCardData?.(entry.card, entry)
      );
    }
    return;
  }
  if (frame.dashboard && frame.dashboard !== currentDashboard.value?.pk) return;
  for (const entry of frame.cards) {
    cardRefs.value[entry.card]?.applyData?.(entry);
  }
  for (const error of frame.errors) {
    cardRefs.value[error.card]?.applyData?.(toErrorEntry(error));
  }
};

/** 轮播 / 数据刷新 / 时钟定时器 + 远程控制通道（实现见 utils/useScreenDisplay.ts） */
const { pageIndex, paused, clock, controlMode, startTimers, startWs } =
  useScreenDisplay({ screen, dashboards, refreshVisible, applyScreenData });

const currentDashboard = computed(
  () => dashboards.value[pageIndex.value] ?? null
);
const currentCards = computed<DashboardCard[]>(
  () => currentDashboard.value?.layout ?? []
);

/** 导出当前屏：逐卡渲染图片并按 ZIP 打包（实现见 utils/useScreenExport.ts，行数门禁抽出） */
const { exporting, exportScreen } = useScreenExport({
  isCanvas,
  currentCards,
  cardRefs,
  paneRefs,
  layoutPanes,
  paneCards
});

const toggleFullscreen = () => {
  if (document.fullscreenElement) {
    void document.exitFullscreen();
  } else {
    void document.documentElement.requestFullscreen?.();
  }
};

/** 详情加载失败标记：缺 pk、接口报错或网络异常都显式呈现，不再静默黑屏 */
const loadFailed = ref(false);

const loadScreen = async () => {
  loadFailed.value = false;
  const pk = String(route.query.pk ?? "");
  const res = pk ? await screenApi.retrieve(pk).catch(() => null) : null;
  if (!res || res.code !== SUCCESS_CODE) {
    loadFailed.value = true;
    return;
  }
  screen.value = res.data as ScreenItem;
  // 仅保留浏览者可见的仪表盘（personal 对他人不在可见列表内）
  const all = listRows<DashboardItem>(
    (await fetchAllRows(dashboardApi.list)) as never
  );
  dashboards.value = (screen.value?.dashboards ?? [])
    .map((id: string) => all.find((item: DashboardItem) => item.pk === id))
    .filter((item): item is DashboardItem => Boolean(item));
  // 指标卡窗格按可见数据集过滤（同仪表盘窗格口径）
  datasets.value = listRows<DatasetItem>(
    (await fetchAllRows(datasetApi.list)) as never
  );
  startTimers();
  startWs(pk);
};

onMounted(loadScreen);
</script>

<template>
  <div class="screen-root fixed inset-0 overflow-auto text-white">
    <!-- 氛围底：径向光晕 + 纵向渐变（恒深色投屏，不随站点主题） -->
    <div class="screen-ambient" aria-hidden="true" />

    <header class="screen-header">
      <div class="flex items-baseline gap-3">
        <!-- 标题内外层保留「大屏名 · 看板名」连读文本（用例按该文本定位），
             视觉层次由内层 span 的字号/透明度表达 -->
        <span class="screen-title">
          {{ screen?.name }}
          <!-- 画布模式没有「当前看板」概念：副标题与页码仅轮播态渲染 -->
          <span v-if="!isCanvas" class="screen-subtitle"
            >· {{ currentDashboard?.name }}</span
          >
        </span>
      </div>
      <span v-if="!isCanvas" class="screen-page"
        >{{ pageIndex + 1 }} / {{ dashboards.length }}</span
      >
      <!-- 远程接管指示：manual 态停本地轮播，回到 auto 后指示消失 -->
      <el-tag
        v-if="controlMode === 'manual'"
        size="small"
        type="warning"
        effect="dark"
      >
        {{ t("dataScreen.remoteControlling") }}
      </el-tag>
      <div class="flex-1" />
      <span class="screen-clock">{{ clock }}</span>
      <el-button
        size="small"
        :icon="DownloadIcon"
        :loading="exporting"
        data-testid="screen-export"
        @click="exportScreen"
      >
        {{ t("dataScreen.exportScreen") }}
      </el-button>
      <el-button
        v-if="!isCanvas"
        size="small"
        :icon="paused ? PlayIcon : PauseIcon"
        :aria-label="paused ? t('dataScreen.resume') : t('dataScreen.pause')"
        :title="paused ? t('dataScreen.resume') : t('dataScreen.pause')"
        data-testid="screen-pause"
        @click="paused = !paused"
      />
      <el-button
        size="small"
        :icon="FullscreenIcon"
        :aria-label="t('dataScreen.fullscreen')"
        :title="t('dataScreen.fullscreen')"
        data-testid="screen-fullscreen"
        @click="toggleFullscreen"
      />
    </header>

    <ReEmpty
      v-if="loadFailed"
      :description="t('dataScreen.loadFailed')"
      icon="ep/warning"
    >
      <el-button size="small" type="primary" @click="loadScreen">
        {{ t("dataScreen.retry") }}
      </el-button>
    </ReEmpty>

    <ReEmpty
      v-else-if="!isCanvas && dashboards.length === 0"
      :description="t('dataScreen.noDashboards')"
      icon="ep/monitor"
    />

    <!-- 画布模式：窗格绝对按 12 列栅格定位；栅格度量经 :style 绑定 layout.ts
         常量派生的 CSS 变量（与设计器同一份来源），保证所见即所得 -->
    <div
      v-if="isCanvas"
      class="screen-canvas"
      :style="canvasGridVars"
      data-testid="screen-canvas"
    >
      <ScreenPane
        v-for="pane in layoutPanes"
        :key="pane.pk"
        :ref="setPaneRef(pane.pk)"
        :pane="pane"
        :cards="paneCards(pane)"
        :clock="clock"
        :dashboard-name="paneTitle(pane)"
      />
    </div>

    <div v-else class="screen-grid">
      <section
        v-for="card in currentCards"
        :key="`${currentDashboard?.pk}-${card.id}`"
        class="screen-card"
        :class="{
          'col-span-3': (card.span ?? 6) === 3,
          'col-span-6': (card.span ?? 6) === 6,
          'col-span-9': (card.span ?? 6) === 9,
          'col-span-12': (card.span ?? 6) === 12
        }"
      >
        <div class="screen-card__title">{{ card.title }}</div>
        <!-- 高度跟随卡片配置（与仪表盘页所见即所得），缺省 224 兼容存量布局 -->
        <div
          class="screen-card__body"
          :class="{
            'screen-card__body--plain':
              card.chart_type === 'number' || card.chart_type === 'metric'
          }"
          :style="{ height: `${card.height ?? 224}px` }"
        >
          <ChartCard
            :key="`${currentDashboard?.pk}-${card.id}`"
            :ref="setCardRef(card.id)"
            :card="card"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<style lang="scss" scoped>
/* 恒深色投屏页（刻意不随站点主题）：色值按深色设计基线写定 */
.screen-root {
  background: #070b14;
}

.screen-ambient {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(
      1100px 520px at 18% -10%,
      rgb(64 158 255 / 16%),
      transparent 62%
    ),
    radial-gradient(
      900px 480px at 100% 0%,
      rgb(154 102 228 / 14%),
      transparent 58%
    ),
    linear-gradient(180deg, #0b1220 0%, #070b14 100%);
}

/* 顶部工具条与卡片同一视觉语言：半透明玻璃 + 细分隔线 */
.screen-header {
  position: relative;
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 14px 24px;
  margin-bottom: 4px;
  background: rgb(255 255 255 / 3%);
  border-bottom: 1px solid rgb(255 255 255 / 6%);
  backdrop-filter: blur(8px);
}

.screen-title {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

/* 看板名：同层级内的次要信息（字号与透明度降一档） */
.screen-subtitle {
  font-size: var(--el-font-size-base);
  font-weight: 400;
  color: rgb(255 255 255 / 62%);
}

.screen-page {
  padding: 1px 8px;
  font-size: var(--el-font-size-extra-small);
  color: rgb(255 255 255 / 70%);
  background: rgb(255 255 255 / 8%);
  border-radius: 999px;
}

.screen-clock {
  font-size: 18px;
  font-variant-numeric: tabular-nums;
  color: rgb(255 255 255 / 85%);
}

.screen-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 16px;
  padding: 4px 24px 24px;
}

/* 画布模式栅格：度量走 layout.ts 常量派生的 CSS 变量（与设计器同一份来源），
   行列步长（行高 + 行距）不一致就会所见非所得 */
.screen-canvas {
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--screen-grid-cols), minmax(0, 1fr));
  grid-auto-rows: var(--screen-row-height);

  /* 行距/列距是 layout.ts 里两个独立常量，刻意分写不用 gap 合并 */
  /* stylelint-disable-next-line declaration-block-no-redundant-longhand-properties */
  row-gap: var(--screen-gap-y);
  column-gap: var(--screen-gap-x);
  align-content: start;
  padding: var(--screen-canvas-padding);
}

.screen-card {
  position: relative;
  padding: 12px 14px 14px;
  background: rgb(255 255 255 / 4%);
  border: 1px solid rgb(255 255 255 / 8%);
  border-radius: 12px;
  box-shadow: 0 8px 28px rgb(0 0 0 / 26%);
  backdrop-filter: blur(6px);
}

.screen-card__title {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  font-size: var(--el-font-size-small);
  color: rgb(255 255 255 / 82%);

  &::before {
    width: 3px;
    height: 12px;
    content: "";
    background: var(--el-color-primary);
    border-radius: 2px;
  }
}

/* 图表内层用站点主题底色：图表按主题渲染，在深色卡片里保持清晰（画框式层次）；
   文字取主题文本色，避免浅底上出现白字 */
.screen-card__body {
  overflow: hidden;
  color: var(--el-text-color-primary);
  background: var(--el-bg-color-overlay);
  border-radius: 8px;

  /* 指标卡（大数字）：不做画框内层，数字直接浮在深色卡上（白色醒目） */
  &--plain {
    color: inherit;
    background: transparent;
    border-radius: 0;
  }
}

/* 恒深色页的空态：文字与底托取白色透明度（不随站点主题的深浅） */
.screen-root :deep(.el-empty__description p) {
  color: rgb(255 255 255 / 62%);
}

.screen-root :deep(.re-empty-art) {
  color: rgb(255 255 255 / 78%);
  background: rgb(255 255 255 / 8%);
}
</style>
