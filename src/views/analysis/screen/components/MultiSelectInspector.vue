<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { ScreenLayoutPane, ScreenPaneType } from "@/api/dataset/analysis";
import type { AlignMode, DistributeAxis } from "../utils/freeAlign";
import type { FreeLayerAction } from "../utils/freePaneOps";
import {
  PANE_ROTATE_MAX,
  PANE_ROTATE_MIN,
  paneAnimationOptions,
  type PaneAnimation
} from "../utils/paneEffects";

defineOptions({ name: "ScreenMultiSelectInspector" });

/**
 * 多选面板（属性面板的多选形态）：选中数量 + 批量属性 + 对齐 / 分布 / 层级 / 复制 / 删除。
 *
 * 批量属性采**统一值语义**（ADR-088 补充交付）：控件显示选区的公共值，多值不一时留空，
 * 一旦设定就把同一个值写给所有「该字段适用」的窗格——适用性过滤与服务端
 * `_normalize_pane_body` 同口径（见 `createFreeEditor.updateMany`），因此本组件只上抛
 * patch，不直接改数据；分布按钮按「≥3 个才有意义」禁用，与纯函数口径一致。
 */
const props = defineProps<{
  count: number;
  /** 选中的窗格（公共值判定 + 控件显隐都按它算） */
  panes?: ScreenLayoutPane[];
}>();

const emit = defineEmits<{
  align: [mode: AlignMode];
  distribute: [axis: DistributeAxis];
  layer: [action: FreeLayerAction];
  duplicate: [];
  remove: [];
  /** 批量改属性（统一值语义，一次一个撤销点） */
  batch: [patch: Partial<ScreenLayoutPane>];
}>();

const { t } = useI18n();

const selected = computed(() => props.panes ?? []);
/** 选区里是否含某类窗格（决定「字号 / 文本格式 / 图片填充」这些类型专属控件是否出现） */
const hasType = (...types: ScreenPaneType[]) =>
  selected.value.some(pane => types.includes(pane.type));

/** 公共值：全部一致才给具体值，否则为空（控件显示占位 / 不选中） */
function commonValue<K extends keyof ScreenLayoutPane>(
  key: K
): ScreenLayoutPane[K] | null {
  const values = selected.value.map(pane => pane[key] ?? null);
  if (values.length === 0) return null;
  const [first] = values;
  return values.every(value => value === first) ? first : null;
}

const batch = (patch: Partial<ScreenLayoutPane>) => emit("batch", patch);
const animationOptions = paneAnimationOptions();

const batchSize = computed(() => commonValue("size") as number | null);
const batchRotate = computed(() => commonValue("rotate") as number | null);
const batchAlign = computed(() => commonValue("align") as string | null);
const batchFormat = computed(() => commonValue("text_format") as string | null);
const batchFit = computed(() => commonValue("fit") as string | null);
const batchAnimation = computed(
  () => commonValue("animation") as string | null
);

const ALIGN_ACTIONS: { mode: AlignMode; key: string }[] = [
  { mode: "left", key: "alignLeftEdge" },
  { mode: "hcenter", key: "alignCenterH" },
  { mode: "right", key: "alignRightEdge" },
  { mode: "top", key: "alignTopEdge" },
  { mode: "vcenter", key: "alignCenterV" },
  { mode: "bottom", key: "alignBottomEdge" }
];

const DISTRIBUTE_ACTIONS: { axis: DistributeAxis; key: string }[] = [
  { axis: "h", key: "distributeH" },
  { axis: "v", key: "distributeV" }
];

const LAYER_ACTIONS: { action: FreeLayerAction; key: string }[] = [
  { action: "top", key: "layerTop" },
  { action: "up", key: "layerUp" },
  { action: "down", key: "layerDown" },
  { action: "bottom", key: "layerBottom" }
];
</script>

<template>
  <div class="multi-panel" data-testid="multi-selection">
    <div class="multi-panel__count" data-testid="multi-count">
      {{ t("dataScreen.multiSelected", { n: count }) }}
    </div>

    <!-- 批量属性：统一值语义（多值不一显示为空，设定即写给所有适用窗格） -->
    <div class="multi-panel__group" data-testid="multi-batch">
      <span class="multi-panel__label">{{ t("dataScreen.multiBatch") }}</span>
      <div class="multi-panel__batch">
        <el-input-number
          v-if="hasType('text', 'clock')"
          :model-value="batchSize ?? undefined"
          :min="14"
          :max="200"
          size="small"
          controls-position="right"
          :placeholder="t('dataScreen.paneFontSize')"
          data-testid="batch-size"
          @change="value => value != null && batch({ size: Number(value) })"
        />
        <el-input-number
          :model-value="batchRotate ?? undefined"
          :min="PANE_ROTATE_MIN"
          :max="PANE_ROTATE_MAX"
          size="small"
          controls-position="right"
          :placeholder="t('dataScreen.paneRotate')"
          data-testid="batch-rotate"
          @change="value => value != null && batch({ rotate: Number(value) })"
        />
        <el-select
          :model-value="batchAnimation ?? undefined"
          size="small"
          :placeholder="t('dataScreen.paneAnimation')"
          data-testid="batch-animation"
          @change="batch({ animation: $event as PaneAnimation })"
        >
          <el-option
            v-for="item in animationOptions"
            :key="item.value"
            :label="t(item.label)"
            :value="item.value"
          />
        </el-select>
        <el-radio-group
          v-if="hasType('text')"
          :model-value="batchAlign ?? undefined"
          size="small"
          data-testid="batch-align"
          @change="batch({ align: $event as 'left' })"
        >
          <el-radio-button value="left">
            {{ t("dataScreen.alignLeft") }}
          </el-radio-button>
          <el-radio-button value="center">
            {{ t("dataScreen.alignCenter") }}
          </el-radio-button>
          <el-radio-button value="right">
            {{ t("dataScreen.alignRight") }}
          </el-radio-button>
        </el-radio-group>
        <el-radio-group
          v-if="hasType('text')"
          :model-value="batchFormat ?? undefined"
          size="small"
          data-testid="batch-text-format"
          @change="batch({ text_format: $event as 'plain' })"
        >
          <el-radio-button value="plain">
            {{ t("dataScreen.textFormatPlain") }}
          </el-radio-button>
          <el-radio-button value="rich">
            {{ t("dataScreen.textFormatRich") }}
          </el-radio-button>
        </el-radio-group>
        <el-radio-group
          v-if="hasType('image')"
          :model-value="batchFit ?? undefined"
          size="small"
          data-testid="batch-fit"
          @change="batch({ fit: $event as 'cover' })"
        >
          <el-radio-button value="cover">
            {{ t("dataScreen.fitCover") }}
          </el-radio-button>
          <el-radio-button value="contain">
            {{ t("dataScreen.fitContain") }}
          </el-radio-button>
          <el-radio-button value="fill">
            {{ t("dataScreen.fitFill") }}
          </el-radio-button>
        </el-radio-group>
      </div>
      <div class="multi-panel__hint">{{ t("dataScreen.multiBatchHint") }}</div>
    </div>

    <div class="multi-panel__group">
      <span class="multi-panel__label">{{ t("dataScreen.align") }}</span>
      <div class="multi-panel__buttons">
        <el-button
          v-for="item in ALIGN_ACTIONS"
          :key="item.mode"
          size="small"
          :data-testid="`align-${item.mode}`"
          @click="emit('align', item.mode)"
        >
          {{ t(`dataScreen.${item.key}`) }}
        </el-button>
      </div>
    </div>

    <div class="multi-panel__group">
      <span class="multi-panel__label">{{ t("dataScreen.distribute") }}</span>
      <div class="multi-panel__buttons">
        <el-button
          v-for="item in DISTRIBUTE_ACTIONS"
          :key="item.axis"
          size="small"
          :disabled="count < 3"
          :data-testid="`distribute-${item.axis}`"
          @click="emit('distribute', item.axis)"
        >
          {{ t(`dataScreen.${item.key}`) }}
        </el-button>
      </div>
    </div>

    <div class="multi-panel__group">
      <span class="multi-panel__label">{{ t("dataScreen.layer") }}</span>
      <div class="multi-panel__buttons">
        <el-button
          v-for="item in LAYER_ACTIONS"
          :key="item.action"
          size="small"
          :data-testid="`multi-layer-${item.action}`"
          @click="emit('layer', item.action)"
        >
          {{ t(`dataScreen.${item.key}`) }}
        </el-button>
      </div>
    </div>

    <div class="multi-panel__group">
      <div class="multi-panel__buttons">
        <el-button
          size="small"
          data-testid="multi-duplicate"
          @click="emit('duplicate')"
        >
          {{ t("dataScreen.duplicate") }}
        </el-button>
        <el-button
          size="small"
          type="danger"
          data-testid="multi-remove"
          @click="emit('remove')"
        >
          {{ t("dataScreen.removePane") }}
        </el-button>
      </div>
    </div>

    <div class="multi-panel__hint">{{ t("dataScreen.multiHint") }}</div>
  </div>
</template>

<style lang="scss" scoped>
.multi-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.multi-panel__count {
  font-size: var(--font-size-md);
  font-weight: 600;
}

.multi-panel__group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.multi-panel__label {
  font-size: var(--el-font-size-extra-small);
  color: var(--screen-fg-dim);
}

.multi-panel__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);

  :deep(.el-button + .el-button) {
    margin-left: 0;
  }
}

/* 批量属性：控件按「有该类型的窗格才出现」排列，窄面板里自动换行 */
.multi-panel__batch {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);

  :deep(.el-input-number) {
    width: 96px;
  }

  :deep(.el-select) {
    width: 120px;
  }

  :deep(.el-radio-group) {
    flex-wrap: wrap;
  }

  :deep(.el-radio-button__inner) {
    padding: var(--space-1) var(--space-2);
  }
}

.multi-panel__hint {
  font-size: var(--el-font-size-extra-small);
  line-height: 1.6;
  color: var(--screen-fg-dim);
}
</style>
