<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { cardRenderHeight } from "@/utils/cardHeight";
import { ChartCardAsync as ChartCard } from "@/views/dashboard/components/ChartCardAsync";
import type { DashboardCard } from "@/api/dataset/datasets";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import type { ExportedImage } from "@/utils/imageExport";
import {
  clampRotate,
  paneAnimationClass,
  paneAnimationStyle
} from "../utils/paneEffects";
import { renderRichText } from "../utils/richText";
import { injectScreenDark } from "../utils/screenTheme";
import PaneMediaView from "./PaneMediaView.vue";

/**
 * 画布窗格渲染（设计器与投屏共用同一组件，所见即所得）。
 *
 * 纯展示 + 暴露数据动作：窗格内容 = 仪表盘卡片组（嵌套 12 列栅格）/ 文本 / 时钟；
 * 拖拽与缩放由外层画布处理——栅格模式上抛 pointerdown（`pane-drag` / `pane-resize`），
 * 自由模式由 `ReResize` 包裹并整块接管手势；时钟文本由父组件统一按秒下发
 * （多窗格共用定时器，避免每窗格一个 interval）。
 *
 * `layout` 决定定位方式：栅格模式按 `x/y/w/h` 落到 CSS Grid 行列；自由模式由
 * 外层盒模型定位，本组件铺满宿主（`position: absolute; inset: 0`）且不渲染
 * 栅格专用的拖拽抓手 / 缩放手柄。
 */
defineOptions({ name: "ScreenPane" });

const props = defineProps<{
  pane: ScreenLayoutPane;
  /** type=dashboard：该仪表盘的可见卡片 */
  cards?: DashboardCard[];
  /** 时钟文本（父组件统一生成） */
  clock?: string;
  /** 仪表盘名（标题兜底） */
  dashboardName?: string;
  /** 设计态：显示选中框与操作入口 */
  editable?: boolean;
  selected?: boolean;
  /** 坐标语义：grid 按栅格行列定位（缺省），free 铺满宿主（外层盒模型定位） */
  layout?: "grid" | "free";
  /** 播放入场动画（仅预览 / 投屏态为 true；编辑态不播，见 utils/paneEffects） */
  playAnimation?: boolean;
}>();

const emit = defineEmits<{
  select: [pk: string];
  remove: [pk: string];
  dragStart: [payload: { pk: string; event: PointerEvent }];
  resizeStart: [payload: { pk: string; event: PointerEvent }];
}>();

const { t } = useI18n();

/** 大屏生效明暗（设计器 / 投屏根节点提供）：图表配色随大屏主题，不受站点主题污染 */
const screenDark = injectScreenDark();
const chartAttrs = computed(() =>
  screenDark.value ? { forceDark: true } : { forceLight: true }
);

type CardHandle = {
  loadData?: () => void;
  applyData?: (_entry: {
    kind?: string;
    data?: unknown;
    detail?: string;
  }) => Promise<void> | void;
  renderImage?: () => Promise<ExportedImage | null>;
};
const cardRefs = ref<Record<string, CardHandle | undefined>>({});
const setCardRef = (cardId: string) => (el: unknown) => {
  const handle = el as CardHandle | null;
  if (handle) cardRefs.value[cardId] = handle;
};

const paneTitle = computed(() => props.pane.title || props.dashboardName || "");
const hasContent = computed(
  () => props.pane.type !== "dashboard" || (props.cards ?? []).length > 0
);

/** 指标卡窗格 → 合成卡（复用 ChartCard 的取数/WS 注入内核；card id 即窗格 pk，
 * 与服务端 screen_data 对 metric 窗格的合成口径一致） */
const metricCard = computed<DashboardCard | null>(() => {
  const pane = props.pane;
  if (pane.type !== "metric" || !pane.dataset) return null;
  return {
    id: pane.pk,
    dataset: pane.dataset,
    title: paneTitle.value || "",
    chart_type: "metric",
    metric: pane.metric ?? "count",
    value_field: pane.value_field ?? ""
  };
});

/** 实际持有卡片的清单：仪表盘窗格取 cards，指标卡取合成卡（刷新/注入/导出共用） */
const innerCards = computed<DashboardCard[]>(() =>
  props.pane.type === "metric"
    ? metricCard.value
      ? [metricCard.value]
      : []
    : (props.cards ?? [])
);

/** 定时刷新可见卡片（投屏 refresh / 设计器「刷新数据」） */
const refresh = () => {
  for (const card of innerCards.value) cardRefs.value[card.id]?.loadData?.();
};

/** 注入单卡数据帧（screen_data 推送通道）：窗格持有该卡时渲染并返回 true */
const applyCardData = (
  cardId: string,
  entry: { kind?: string; data?: unknown; detail?: string }
) => {
  if (!innerCards.value.some(card => card.id === cardId)) return false;
  void cardRefs.value[cardId]?.applyData?.(entry);
  return true;
};

/** 逐卡渲染图片（投屏导出 ZIP 用；非图表卡返回 null 由调用方计入跳过数） */
const renderImages = async () => {
  const images: { cardId: string; title: string; image: ExportedImage }[] = [];
  for (const card of innerCards.value) {
    const image = await cardRefs.value[card.id]?.renderImage?.();
    if (image) images.push({ cardId: card.id, title: card.title, image });
  }
  return images;
};

defineExpose({ refresh, applyCardData, renderImages });

/**
 * 栅格定位：x/y 为列/行下标（+1 转 CSS 的 1 起编号）；自由模式由外层盒模型定位。
 * 旋转叠加在定位之上（`transform-origin: center`）：**视觉旋转**，不进几何——
 * 吸附 / 框选 / 对齐仍按未旋转的盒模型算（见 utils/paneEffects）。
 */
const rotate = computed(() => clampRotate(props.pane.rotate));

/** 编辑件反向旋转：手柄 / 抓手始终轴对齐（旋转的只是内容视觉） */
const counterRotate = computed(() =>
  rotate.value ? { transform: `rotate(${-rotate.value}deg)` } : {}
);

/** 入场动画类名（仅展示态；`playAnimation` 为 false 时恒为空） */
const animationClass = computed(() =>
  props.playAnimation ? paneAnimationClass(props.pane.animation) : ""
);

/** 动画时序（时长 / 延迟 / 循环）：只在真的要播时写内联样式，编辑态保持载荷原样 */
const animationStyle = computed(() =>
  animationClass.value ? paneAnimationStyle(props.pane) : {}
);

const paneStyle = computed(() => ({
  ...(props.layout === "free"
    ? { position: "absolute" as const, inset: "0" }
    : {
        gridColumn: `${props.pane.x + 1} / span ${props.pane.w}`,
        gridRow: `${props.pane.y + 1} / span ${props.pane.h}`
      }),
  ...(rotate.value ? { transform: `rotate(${rotate.value}deg)` } : {}),
  ...animationStyle.value
}));

/** 富文本渲染结果（受限标记 → 白名单 HTML；纯文本为空串，走插值分支） */
const richHtml = computed(() =>
  props.pane.type === "text" &&
  props.pane.text_format === "rich" &&
  props.pane.text
    ? renderRichText(props.pane.text)
    : ""
);

/** 媒体类窗格（图片 / 视频 / 自定义 HTML）：内容交给 PaneMediaView 渲染 */
const isMediaPane = computed(() =>
  ["image", "video", "html"].includes(props.pane.type)
);

/** 栅格模式由本组件承接拖拽 / 缩放入口；自由模式手势归外层 ReResize */
const gridEditable = computed(() => props.editable && props.layout !== "free");

const textStyle = computed(() => ({
  textAlign: props.pane.align ?? "left",
  fontSize: `${props.pane.size ?? 24}px`
}));

const clockStyle = computed(() => ({
  fontSize: `${props.pane.size ?? 40}px`
}));
</script>

<template>
  <div
    class="screen-pane"
    :class="[
      { 'is-editable': editable, 'is-selected': selected },
      animationClass
    ]"
    :style="paneStyle"
    :data-pane-id="pane.pk"
    :data-pane-type="pane.type"
    :data-pane-animation="pane.animation || 'none'"
    @pointerdown="editable && emit('select', pane.pk)"
  >
    <div
      v-if="gridEditable"
      class="screen-pane__grip"
      :style="counterRotate"
      :title="t('dataScreen.dragHint')"
      data-testid="pane-drag"
      @pointerdown.stop="emit('dragStart', { pk: pane.pk, event: $event })"
    />
    <div v-if="editable" class="screen-pane__tools" :style="counterRotate">
      <el-button
        size="small"
        text
        type="danger"
        data-testid="pane-remove"
        @pointerdown.stop
        @click.stop="emit('remove', pane.pk)"
      >
        {{ t("dataScreen.removePane") }}
      </el-button>
    </div>

    <div v-if="paneTitle" class="screen-pane__title">{{ paneTitle }}</div>

    <div
      v-if="pane.type === 'text'"
      class="screen-pane__text"
      :style="textStyle"
      data-testid="pane-text"
    >
      <!-- 富文本：内容由 utils/richText 生成（先转义再套白名单），不接受外部 HTML -->
      <span v-if="richHtml" v-html="richHtml" />
      <template v-else>{{
        pane.text || t("dataScreen.textPlaceholder")
      }}</template>
    </div>

    <div
      v-else-if="pane.type === 'clock'"
      class="screen-pane__clock"
      :style="clockStyle"
      data-testid="pane-clock"
    >
      {{ clock || "--:--:--" }}
    </div>

    <!-- 媒体类内容（图片 / 视频 / 自定义 HTML）由子组件渲染：行数门禁拆分，口径见 PaneMediaView -->
    <PaneMediaView
      v-else-if="isMediaPane"
      :pane="pane"
      :editable="editable"
      :play-animation="playAnimation"
    />

    <div v-else-if="hasContent" class="screen-pane__grid">
      <section
        v-for="card in innerCards"
        :key="card.id"
        class="screen-card"
        :class="{
          'col-span-3': (card.span ?? 6) === 3,
          'col-span-6': (card.span ?? 6) === 6,
          'col-span-9': (card.span ?? 6) === 9,
          'col-span-12': (card.span ?? 6) === 12
        }"
      >
        <div v-if="card.title" class="screen-card__title">
          {{ card.title }}
        </div>
        <div
          class="screen-card__body"
          :class="{
            'screen-card__body--plain':
              card.chart_type === 'number' || card.chart_type === 'metric'
          }"
          :style="{ height: `${cardRenderHeight(card.height)}px` }"
        >
          <ChartCard
            :ref="setCardRef(card.id)"
            :card="card"
            v-bind="chartAttrs"
          />
        </div>
      </section>
    </div>

    <div v-else class="screen-pane__empty" data-testid="pane-empty">
      {{ t("dataScreen.paneNoCard") }}
    </div>

    <div
      v-if="gridEditable"
      class="screen-pane__resize"
      :style="counterRotate"
      data-testid="pane-resize"
      @pointerdown.stop="emit('resizeStart', { pk: pane.pk, event: $event })"
    />
  </div>
</template>

<style lang="scss" scoped>
/* 入场动画：类名由 utils/paneEffects 给出，样式定义在共享 partial 里
   （keyframes 与本组件 scoped 样式一起编译，命名口径一致；编辑态不挂类 = 不播） */
@use "@/style/screen-animations";
@use "@/style/screen-richtext";

/* 窗格视觉与投屏页一致（恒深色画布）：设计器与展示端共用，保证所见即所得 */
.screen-pane {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 12px 14px 14px;
  overflow: hidden;
  background: var(--screen-surface-raised);
  border: 1px solid var(--screen-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--screen-shadow);
  backdrop-filter: blur(6px);

  &.is-editable {
    cursor: grab;
    user-select: none;
  }

  &.is-selected {
    border-color: var(--el-color-primary);
    box-shadow: 0 0 0 1px var(--el-color-primary);
  }
}

.screen-pane__grid {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: var(--space-3);
  align-content: start;
}

.screen-pane__title {
  display: flex;
  flex: none;
  gap: var(--space-2);
  align-items: center;
  margin-bottom: var(--space-2);
  font-size: var(--el-font-size-small);
  color: var(--screen-fg-strong);

  &::before {
    width: 3px;
    height: 12px;
    content: "";
    background: var(--el-color-primary);
    border-radius: 2px;
  }
}

.screen-card {
  position: relative;
  padding: 10px 12px 12px;
  background: var(--screen-surface-raised);
  border: 1px solid var(--screen-border);
  border-radius: var(--radius-xl);
}

.screen-card__title {
  margin-bottom: var(--space-2);
  font-size: var(--el-font-size-extra-small);
  color: var(--screen-fg-dense);
}

/* 图表直接浮在窗格表面上（不铺站点主题底色作「画框」）：图表配色由大屏主题
   决定（深色 → force-dark，浅色 → force-light），站点明暗不参与 */
.screen-card__body {
  overflow: hidden;
  color: var(--screen-fg-strong);
  background: transparent;
  border-radius: var(--radius-lg);

  &--plain {
    color: var(--screen-fg-bold);
    background: transparent;
    border-radius: 0;
  }
}

.screen-pane__text {
  flex: 1;
  overflow: auto;
  font-weight: 600;
  line-height: 1.5;
  color: var(--screen-fg-bold);
  white-space: pre-wrap;
}

.screen-pane__clock {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  font-variant-numeric: tabular-nums;
  color: var(--screen-fg-bold);
}

/* 图片窗格：占满窗格内容区，填充方式由窗格配置（object-fit）决定 */
.screen-pane__image {
  flex: 1;
  width: 100%;
  min-height: 0;
  object-position: center;
  border-radius: var(--radius-md);
}

.screen-pane__empty {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  font-size: var(--el-font-size-small);
  color: var(--screen-fg-dim);
}

/* 设计态操作件：拖拽区（左上角抓手）与缩放柄（右下角） */
.screen-pane__grip {
  position: absolute;
  top: 6px;
  left: 6px;
  width: 18px;
  height: 18px;
  cursor: grab;
  background-image: radial-gradient(var(--screen-fg-dim) 1px, transparent 0);
  background-size: 5px 5px;
}

.screen-pane__resize {
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  background: linear-gradient(
    135deg,
    transparent 45%,
    var(--el-color-primary) 45%,
    var(--el-color-primary) 55%,
    transparent 55%
  );
}

.screen-pane__tools {
  position: absolute;
  top: 2px;
  right: 6px;
  z-index: 2;
}
</style>
