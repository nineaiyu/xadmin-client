<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import {
  PANE_ANIMATION_DELAY_DEFAULT,
  PANE_ANIMATION_DURATION_DEFAULT,
  PANE_ANIMATION_MS_MAX,
  clampAnimationMs,
  paneAnimationOptions,
  type PaneAnimation
} from "../utils/paneEffects";

defineOptions({ name: "ScreenPaneAnimationFields" });

/**
 * 窗格动画字段（属性面板的动画区，ADR-088/089）：动画种类 + 时长 / 延迟 / 循环。
 *
 * 时序三项**只在配了动画时出现**（`none` 时服务端会静默忽略，面板上就不给入口）；
 * 所有夹取走 `utils/paneEffects` 的同一份口径（与服务端 `_normalize_pane_body` 同值），
 * 本组件只上抛 patch，不直接改数据（拆分动机：属性面板行数门禁）。
 */
const props = defineProps<{ pane: ScreenLayoutPane }>();

const emit = defineEmits<{ update: [patch: Partial<ScreenLayoutPane>] }>();

const { t } = useI18n();

const animationOptions = paneAnimationOptions();

const animation = computed({
  get: () => props.pane.animation ?? "none",
  set: (value: PaneAnimation) => emit("update", { animation: value })
});
const hasAnimation = computed(
  () => (props.pane.animation ?? "none") !== "none"
);
const animationDuration = computed({
  get: () =>
    clampAnimationMs(
      props.pane.animation_duration,
      PANE_ANIMATION_DURATION_DEFAULT,
      100
    ),
  set: (value: number) =>
    emit("update", {
      animation_duration: clampAnimationMs(
        value,
        PANE_ANIMATION_DURATION_DEFAULT,
        100
      )
    })
});
const animationDelay = computed({
  get: () =>
    clampAnimationMs(props.pane.animation_delay, PANE_ANIMATION_DELAY_DEFAULT),
  set: (value: number) =>
    emit("update", {
      animation_delay: clampAnimationMs(value, PANE_ANIMATION_DELAY_DEFAULT)
    })
});
const animationLoop = computed({
  get: () => Boolean(props.pane.animation_loop),
  set: (value: boolean) => emit("update", { animation_loop: value })
});
</script>

<template>
  <el-form-item :label="t('dataScreen.paneAnimation')">
    <el-select
      v-model="animation"
      size="small"
      data-testid="inspector-animation"
    >
      <el-option
        v-for="item in animationOptions"
        :key="item.value"
        :label="t(item.label)"
        :value="item.value"
      />
    </el-select>
  </el-form-item>

  <template v-if="hasAnimation">
    <el-form-item :label="t('dataScreen.paneAnimationDuration')">
      <el-input-number
        v-model="animationDuration"
        :min="100"
        :max="PANE_ANIMATION_MS_MAX"
        :step="50"
        controls-position="right"
        data-testid="inspector-animation-duration"
      />
    </el-form-item>
    <el-form-item :label="t('dataScreen.paneAnimationDelay')">
      <el-input-number
        v-model="animationDelay"
        :min="0"
        :max="PANE_ANIMATION_MS_MAX"
        :step="50"
        controls-position="right"
        data-testid="inspector-animation-delay"
      />
    </el-form-item>
    <el-form-item :label="t('dataScreen.paneAnimationLoop')">
      <el-switch
        v-model="animationLoop"
        data-testid="inspector-animation-loop"
      />
    </el-form-item>
  </template>
</template>
