<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import ChartCard from "@/views/dashboard/components/ChartCard.vue";
import type { DashboardCard } from "@/api/dataset/datasets";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import type { ExportedImage } from "@/utils/imageExport";

/**
 * 画布窗格渲染（设计器与投屏共用同一组件，所见即所得）。
 *
 * 纯展示 + 暴露数据动作：窗格内容 = 仪表盘卡片组（嵌套 12 列栅格）/ 文本 / 时钟；
 * 拖拽与缩放由设计器在窗格外层处理（本组件只上抛 pointerdown，不持有画布坐标系），
 * 时钟文本由父组件统一按秒下发（多窗格共用定时器，避免每窗格一个 interval）。
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
}>();

const emit = defineEmits<{
  select: [pk: string];
  remove: [pk: string];
  dragStart: [payload: { pk: string; event: PointerEvent }];
  resizeStart: [payload: { pk: string; event: PointerEvent }];
}>();

const { t } = useI18n();

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

/** 定时刷新可见卡片（投屏 refresh / 设计器「刷新数据」） */
const refresh = () => {
  for (const card of props.cards ?? []) cardRefs.value[card.id]?.loadData?.();
};

/** 注入单卡数据帧（screen_data 推送通道）：窗格持有该卡时渲染并返回 true */
const applyCardData = (
  cardId: string,
  entry: { kind?: string; data?: unknown; detail?: string }
) => {
  if (!(props.cards ?? []).some(card => card.id === cardId)) return false;
  void cardRefs.value[cardId]?.applyData?.(entry);
  return true;
};

/** 逐卡渲染图片（投屏导出 ZIP 用；非图表卡返回 null 由调用方计入跳过数） */
const renderImages = async () => {
  const images: { cardId: string; title: string; image: ExportedImage }[] = [];
  for (const card of props.cards ?? []) {
    const image = await cardRefs.value[card.id]?.renderImage?.();
    if (image) images.push({ cardId: card.id, title: card.title, image });
  }
  return images;
};

defineExpose({ refresh, applyCardData, renderImages });

const paneTitle = computed(() => props.pane.title || props.dashboardName || "");
const hasContent = computed(
  () => props.pane.type !== "dashboard" || (props.cards ?? []).length > 0
);

/** 栅格定位：x/y 为列/行下标（+1 转 CSS 的 1 起编号） */
const paneStyle = computed(() => ({
  gridColumn: `${props.pane.x + 1} / span ${props.pane.w}`,
  gridRow: `${props.pane.y + 1} / span ${props.pane.h}`
}));

const textStyle = computed(() => ({
  textAlign: props.pane.align ?? "left",
  fontSize: `${props.pane.size ?? 24}px`
}));
</script>

<template>
  <div
    class="screen-pane"
    :class="{ 'is-editable': editable, 'is-selected': selected }"
    :style="paneStyle"
    :data-pane-id="pane.pk"
    :data-pane-type="pane.type"
    @pointerdown="editable && emit('select', pane.pk)"
  >
    <div
      v-if="editable"
      class="screen-pane__grip"
      :title="t('dataScreen.dragHint')"
      data-testid="pane-drag"
      @pointerdown.stop="emit('dragStart', { pk: pane.pk, event: $event })"
    />
    <div v-if="editable" class="screen-pane__tools">
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
      {{ pane.text || t("dataScreen.textPlaceholder") }}
    </div>

    <div
      v-else-if="pane.type === 'clock'"
      class="screen-pane__clock"
      data-testid="pane-clock"
    >
      {{ clock || "--:--:--" }}
    </div>

    <div v-else-if="hasContent" class="screen-pane__grid">
      <section
        v-for="card in cards"
        :key="card.id"
        class="screen-card"
        :class="{
          'col-span-3': (card.span ?? 6) === 3,
          'col-span-6': (card.span ?? 6) === 6,
          'col-span-9': (card.span ?? 6) === 9,
          'col-span-12': (card.span ?? 6) === 12
        }"
      >
        <div class="screen-card__title">{{ card.title }}</div>
        <div
          class="screen-card__body"
          :class="{ 'screen-card__body--plain': card.chart_type === 'number' }"
          :style="{ height: `${card.height ?? 224}px` }"
        >
          <ChartCard :ref="setCardRef(card.id)" :card="card" />
        </div>
      </section>
    </div>

    <div v-else class="screen-pane__empty" data-testid="pane-empty">
      {{ t("dataScreen.paneNoCard") }}
    </div>

    <div
      v-if="editable"
      class="screen-pane__resize"
      data-testid="pane-resize"
      @pointerdown.stop="emit('resizeStart', { pk: pane.pk, event: $event })"
    />
  </div>
</template>

<style lang="scss" scoped>
/* 窗格视觉与投屏页一致（恒深色画布）：设计器与展示端共用，保证所见即所得 */
.screen-pane {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 12px 14px 14px;
  overflow: hidden;
  background: rgb(255 255 255 / 4%);
  border: 1px solid rgb(255 255 255 / 8%);
  border-radius: 12px;
  box-shadow: 0 8px 28px rgb(0 0 0 / 26%);
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
  gap: 12px;
  align-content: start;
}

.screen-pane__title {
  display: flex;
  flex: none;
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

.screen-card {
  position: relative;
  padding: 10px 12px 12px;
  background: rgb(255 255 255 / 4%);
  border: 1px solid rgb(255 255 255 / 8%);
  border-radius: 10px;
}

.screen-card__title {
  margin-bottom: 8px;
  font-size: var(--el-font-size-extra-small);
  color: rgb(255 255 255 / 78%);
}

/* 图表内层用站点主题底色：图表按主题渲染，在深色卡片里保持清晰（与投屏页同口径） */
.screen-card__body {
  overflow: hidden;
  color: var(--el-text-color-primary);
  background: var(--el-bg-color-overlay);
  border-radius: 8px;

  &--plain {
    color: inherit;
    background: transparent;
    border-radius: 0;
  }
}

.screen-pane__text {
  flex: 1;
  overflow: auto;
  font-weight: 600;
  line-height: 1.5;
  color: rgb(255 255 255 / 92%);
  white-space: pre-wrap;
}

.screen-pane__clock {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  font-variant-numeric: tabular-nums;
  color: rgb(255 255 255 / 92%);
}

.screen-pane__empty {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  font-size: var(--el-font-size-small);
  color: rgb(255 255 255 / 55%);
}

/* 设计态操作件：拖拽区（左上角抓手）与缩放柄（右下角） */
.screen-pane__grip {
  position: absolute;
  top: 6px;
  left: 6px;
  width: 18px;
  height: 18px;
  cursor: grab;
  background-image: radial-gradient(rgb(255 255 255 / 55%) 1px, transparent 0);
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
