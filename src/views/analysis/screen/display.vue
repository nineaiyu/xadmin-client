<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import type { ScreenItem } from "@/api/dataset/analysis";
import type {
  DashboardCard,
  DashboardItem,
  DatasetItem
} from "@/api/dataset/datasets";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useScreenDisplay } from "./utils/useScreenDisplay";
import { useScreenExport } from "./utils/useScreenExport";
import { useScreenLoader } from "./utils/useScreenLoader";
import { useScreenCards } from "./utils/useScreenCards";
import { useFreeStage } from "./utils/useFreeStage";
import { useDisplayTheme } from "./utils/useDisplayTheme";
import { visiblePanes } from "./utils/paneVisibility";
import { cardRenderHeight } from "@/utils/cardHeight";
import { canvasGridVars } from "./utils/layout";
import { ChartCardAsync as ChartCard } from "@/views/dashboard/components/ChartCardAsync";
import ScreenPane from "./components/ScreenPane.vue";
import DisplayThemePanel from "./components/DisplayThemePanel.vue";
import ScreenFreeStage from "./components/ScreenFreeStage.vue";
import ReEmpty from "@/components/ReEmpty";
import PauseIcon from "~icons/ep/video-pause";
import PlayIcon from "~icons/ep/video-play";
import FullscreenIcon from "~icons/ep/full-screen";
import DownloadIcon from "~icons/ep/download";
import CameraIcon from "~icons/ep/camera";
import BackIcon from "~icons/ep/back";

defineOptions({
  name: "DataScreenDisplay"
});

/**
 * 大屏投屏：三种形态共用一页——自由画布（自由载荷窗格非空）/ 栅格画布（`layout`
 * 非空）/ 仪表盘轮播（皆空，存量形态），判定与服务端同序。
 * 权限复用仪表盘可见性：对当前浏览者不可见的仪表盘与数据集自动跳过。
 * 图表渲染复用一期的 ChartCard（defineExpose loadData 供定时刷新）。
 *
 * 远程控制：连接 ws/screen/<pk> 接收管理端指令（切换/翻页/刷新/恢复轮播）；
 * manual 态停本地轮播并停在远程指定页，auto 态恢复轮播。控制帧按
 * 「服务端 dashboards 下标 → 本地可见列表」映射，跳过不可见仪表盘不会错位。
 */

const { t } = useI18n();

const screen = ref<ScreenItem | null>(null);
const dashboards = ref<DashboardItem[]>([]);
/** 可见数据集（服务端按浏览者过滤）：指标卡窗格按此口径过滤，与仪表盘窗格一致 */
const datasets = ref<DatasetItem[]>([]);

/**
 * 形态判定（与服务端同序）：自由画布（自由载荷窗格非空）> 栅格画布（`layout` 非空）
 * > 轮播。两种画布与轮播同一可见性口径：窗格引用的仪表盘 / 数据集对浏览者不可见时
 * 整格跳过（后端口径同 `can_view_screen` + 执行侧 fail-closed，前端只做展示层过滤）。
 */
const layoutPanes = computed(() =>
  visiblePanes(screen.value?.layout ?? [], dashboards.value, datasets.value)
);
const { freeLayout, freePanes, isFree } = useFreeStage({
  screen,
  dashboards,
  datasets
});
const isCanvas = computed(() => !isFree.value && layoutPanes.value.length > 0);
/** 画布态（栅格 / 自由）：无轮播页码与暂停控件，刷新与导出逐窗格 */
const isStage = computed(() => isFree.value || isCanvas.value);
const activePanes = computed(() =>
  isFree.value ? freePanes.value : layoutPanes.value
);
const paneCards = (pane: { dashboard?: string }) =>
  dashboards.value.find(item => item.pk === pane.dashboard)?.layout ?? [];
const paneTitle = (pane: { dashboard?: string }) =>
  dashboards.value.find(item => item.pk === pane.dashboard)?.name ?? "";

/** 轮播 / 数据刷新 / 时钟定时器 + 远程控制通道（实现见 utils/useScreenDisplay.ts）；
 *  句柄收集与数据帧应用见 utils/useScreenCards.ts（两处回调按调用期解析） */
const { pageIndex, paused, clock, controlMode, startTimers, startWs } =
  useScreenDisplay({
    screen,
    dashboards,
    refreshVisible: () => screenCards.refreshVisible(),
    applyScreenData: frame => screenCards.applyScreenData(frame)
  });

const currentDashboard = computed(
  () => dashboards.value[pageIndex.value] ?? null
);
const currentCards = computed<DashboardCard[]>(
  () => currentDashboard.value?.layout ?? []
);

/** 卡片/窗格句柄收集 + 数据帧应用 + 可见刷新（实现见 utils/useScreenCards.ts，行数门禁抽出） */
const screenCards = useScreenCards({ isStage, currentCards, currentDashboard });
const { cardRefs, setCardRef, paneRefs, setPaneRef } = screenCards;

/** 导出当前屏：逐卡渲染图片并按 ZIP 打包（实现见 utils/useScreenExport.ts，行数门禁抽出） */
const { exporting, exportScreen, exportScreenSnapshot } = useScreenExport({
  isCanvas: isStage,
  currentCards,
  cardRefs,
  paneRefs,
  layoutPanes: activePanes,
  paneCards,
  screenTitle: () => String(screen.value?.name ?? ""),
  isDark: () => screenDark.value
});

const toggleFullscreen = () => {
  if (document.fullscreenElement) {
    void document.exitFullscreen();
  } else {
    // 浏览器策略拒绝（非用户手势触发 / 已有全屏方等）是常态：静默吞掉，
    // 避免控制台 unhandled rejection；投屏页保持当前渲染即可
    void Promise.resolve(document.documentElement.requestFullscreen?.()).catch(
      () => undefined
    );
  }
};

/**
 * 大屏主题（深色缺省 / 浅色 / 跟随站点）：根节点令牌与图表配色统一由此驱动。
 * 投屏端允许本机临时切换（不落库），创建者可在面板里「保存为默认」。
 */
const themeRoot = ref<HTMLElement>();
const router = useRouter();
const {
  screenDark,
  theme: displayTheme,
  themeColor: displayThemeColor,
  overridden: themeOverridden,
  saving: themeSaving,
  canSave: canSaveTheme,
  onChange: onThemeChange,
  reset: resetTheme,
  save: saveThemeAsDefault
} = useDisplayTheme({ t, screen, root: themeRoot });

/** 返回大屏列表：直达打开（无站内历史）时兜底到列表页 */
const goBack = () => {
  if (window.history.state?.back) router.back();
  else router.push("/analysis/screen/index");
};

/** 详情装载（失败标记 + 重试入口，实现见 utils/useScreenLoader.ts，行数门禁抽出） */
const { loadFailed, loadScreen } = useScreenLoader({
  screen,
  dashboards,
  datasets,
  onLoaded: pk => {
    startTimers();
    startWs(pk);
  }
});

onMounted(loadScreen);
</script>

<template>
  <div
    ref="themeRoot"
    class="screen-root fixed inset-0 overflow-auto"
    :class="{
      'is-free': isFree,
      'screen-root--light': !screenDark,
      'text-(--el-color-white)': screenDark,
      'text-(--screen-fg)': !screenDark
    }"
    :data-screen-theme="screenDark ? 'dark' : 'light'"
  >
    <!-- 氛围底：径向光晕 + 纵向渐变（明暗由大屏主题决定，不随站点主题） -->
    <div class="screen-ambient" aria-hidden="true" />

    <header class="screen-header">
      <el-button
        size="small"
        :icon="BackIcon"
        :aria-label="t('dataScreen.backToList')"
        :title="t('dataScreen.backToList')"
        data-testid="screen-back"
        @click="goBack"
      />
      <div class="flex items-baseline gap-3">
        <!-- 标题内外层保留「大屏名 · 看板名」连读文本（用例按该文本定位），
             视觉层次由内层 span 的字号/透明度表达 -->
        <span class="screen-title">
          {{ screen?.name }}
          <!-- 画布态（栅格 / 自由）没有「当前看板」概念：副标题与页码仅轮播态渲染 -->
          <span v-if="!isStage" class="screen-subtitle"
            >· {{ currentDashboard?.name }}</span
          >
        </span>
      </div>
      <span v-if="!isStage" class="screen-page"
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
      <DisplayThemePanel
        :theme="displayTheme"
        :theme-color="displayThemeColor"
        :overridden="themeOverridden"
        :can-save="canSaveTheme"
        :saving="themeSaving"
        @change="onThemeChange"
        @reset="resetTheme"
        @save="saveThemeAsDefault"
      />
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
        size="small"
        :icon="CameraIcon"
        :loading="exporting"
        data-testid="screen-export-snapshot"
        :title="t('dataScreen.exportSnapshotTip')"
        @click="exportScreenSnapshot"
      >
        {{ t("dataScreen.exportSnapshot") }}
      </el-button>
      <el-button
        v-if="!isStage"
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
      v-else-if="!isStage && dashboards.length === 0"
      :description="t('dataScreen.noDashboards')"
      icon="ep/monitor"
    />

    <!-- 自由画布：按基准设计画幅固定尺寸渲染 + 整体等比缩放（contain 居中，letterbox
         用画布底色）；窗格渲染与栅格共用 ScreenPane，缩放只作用于展示不写回数据 -->
    <ScreenFreeStage
      v-if="isFree"
      :panes="freePanes"
      :design="freeLayout.design"
      :clock="clock"
      :pane-cards="paneCards"
      :pane-title="paneTitle"
      :set-pane-ref="setPaneRef"
    />

    <!-- 栅格画布：窗格绝对按 12 列栅格定位；栅格度量经 :style 绑定 layout.ts
         常量派生的 CSS 变量（与设计器同一份来源），保证所见即所得 -->
    <div
      v-else-if="isCanvas"
      class="screen-canvas"
      :style="canvasGridVars"
      data-testid="screen-canvas"
    >
      <ScreenPane
        v-for="pane in layoutPanes"
        :key="pane.pk"
        :ref="setPaneRef(pane.pk)"
        play-animation
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
        <!-- 高度跟随卡片配置（与仪表盘页所见即所得），缺省档位见 utils/cardHeight -->
        <div
          class="screen-card__body"
          :class="{
            'screen-card__body--plain':
              card.chart_type === 'number' || card.chart_type === 'metric'
          }"
          :style="{ height: `${cardRenderHeight(card.height)}px` }"
        >
          <ChartCard
            :key="`${currentDashboard?.pk}-${card.id}`"
            :ref="setCardRef(card.id)"
            :card="card"
            :force-dark="screenDark"
            :force-light="!screenDark"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/style/screen-carousel";

/* 大屏投屏页：明暗由大屏主题决定（深色缺省 / 浅色成对覆写），色值一律走 --screen-* 令牌 */
.screen-root {
  background: var(--screen-canvas);
}

/* 自由画布：舞台按设计画幅固定尺寸后整体缩放，页面转为纵向弹性布局
   （避免 1:1 画幅把页面撑出滚动条），letterbox 由舞台组件用画布底色铺满 */
.screen-root.is-free {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.screen-ambient {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(
      1100px 520px at 18% -10%,
      var(--screen-glow-primary),
      transparent 62%
    ),
    radial-gradient(
      900px 480px at 100% 0%,
      var(--screen-glow-accent),
      transparent 58%
    ),
    linear-gradient(
      180deg,
      var(--screen-canvas-top) 0%,
      var(--screen-canvas) 100%
    );
}

/* 顶部工具条与卡片同一视觉语言：半透明玻璃 + 细分隔线 */
.screen-header {
  position: relative;
  display: flex;
  gap: var(--space-3);
  align-items: center;
  padding: 14px 24px;
  margin-bottom: var(--space-1);
  background: var(--screen-surface);
  border-bottom: 1px solid var(--screen-border-subtle);
  backdrop-filter: blur(8px);
}

.screen-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  letter-spacing: 0.02em;
}

/* 看板名：同层级内的次要信息（字号与透明度降一档） */
.screen-subtitle {
  font-size: var(--el-font-size-base);
  font-weight: 400;
  color: var(--screen-fg-subtle);
}

.screen-page {
  padding: 1px 8px;
  font-size: var(--el-font-size-extra-small);
  color: var(--screen-fg-muted);
  background: var(--screen-surface-strong);
  border-radius: var(--radius-full);
}

.screen-clock {
  font-size: var(--font-size-lg);
  font-variant-numeric: tabular-nums;
  color: var(--screen-fg);
}

/* 空态：插画与图标改取大屏前景色（不随站点主题的深浅） */
.screen-root :deep(.el-empty__description p) {
  color: var(--screen-fg-subtle);
}

.screen-root :deep(.re-empty-art) {
  --el-svg-monochrome-grey: var(--screen-fg-dense);
  --re-empty-sheet-bg: var(--screen-surface-strong);

  color: var(--screen-fg-dense);
}
</style>
