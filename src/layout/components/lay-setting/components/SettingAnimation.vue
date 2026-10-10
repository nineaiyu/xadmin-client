<script lang="ts" setup>
// 系统设置面板「通用」：页面切换动画（预览卡片常驻循环播放，与 vben 口径一致，
// 无需重新触发即可实时看到每个预设的动效）。
// 预设清单与 style/transition.scss 的过渡类名前缀一一对应，none = 关闭过渡。
import { computed } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import { useConfigureStorage } from "../hooks/useConfigureStorage";
import PrefBlock from "./PrefBlock.vue";

const { t } = useNav();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { storageConfigureChange } = useConfigureStorage();

/** 预设清单（value 与 style/transition.scss 的类名前缀同源） */
const PRESETS: Array<{ value: PageTransitionType; labelKey: string }> = [
  { value: "none", labelKey: "layout.transitionNone" },
  { value: "fade-transform", labelKey: "layout.transitionFadeTransform" },
  { value: "fade-slide", labelKey: "layout.transitionFadeSlide" },
  { value: "fade-up", labelKey: "layout.transitionFadeUp" },
  { value: "fade-down", labelKey: "layout.transitionFadeDown" },
  { value: "fade-scale", labelKey: "layout.transitionFadeScale" }
];

const options = computed(() =>
  PRESETS.map(item => ({ value: item.value, label: t(item.labelKey) }))
);

const pageTransition = computed<PageTransitionType>({
  get: () => $storage?.configure?.pageTransition ?? "fade-transform",
  set: value => storageConfigureChange("pageTransition", value)
});
</script>

<template>
  <PrefBlock
    :title="t('layout.pageTransition')"
    :tip="t('layout.pageTransitionTip')"
  >
    <ul class="anim-grid">
      <li
        v-for="item in options"
        :key="item.value"
        class="anim-card"
        :class="{ 'is-active': pageTransition === item.value }"
        :data-transition="item.value"
        @click="pageTransition = item.value"
      >
        <span class="anim-card__stage">
          <span
            class="anim-card__block"
            :class="`anim-card__block--${item.value}`"
          />
        </span>
        <span class="anim-card__label">{{ item.label }}</span>
      </li>
    </ul>
  </PrefBlock>
</template>

<style lang="scss" scoped>
/* 预览关键帧按各预设的进入/离开位移等比缩小（原值见 style/transition.scss），
   形态对齐 vben：0% → 50% → 100% 位移穿越，中途完全可见 */
@keyframes anim-card-fade-transform {
  0% {
    opacity: 0;
    transform: translateX(-18px);
  }

  50% {
    opacity: 1;
    transform: translateX(0);
  }

  100% {
    opacity: 0;
    transform: translateX(18px);
  }
}

@keyframes anim-card-fade-slide {
  0% {
    opacity: 0;
    transform: translateX(-12px);
  }

  50% {
    opacity: 1;
    transform: translateX(0);
  }

  100% {
    opacity: 0;
    transform: translateX(12px);
  }
}

@keyframes anim-card-fade-up {
  0% {
    opacity: 0;
    transform: translateY(8px);
  }

  50% {
    opacity: 1;
    transform: translateY(0);
  }

  100% {
    opacity: 0;
    transform: translateY(-8px);
  }
}

@keyframes anim-card-fade-down {
  0% {
    opacity: 0;
    transform: translateY(-8px);
  }

  50% {
    opacity: 1;
    transform: translateY(0);
  }

  100% {
    opacity: 0;
    transform: translateY(8px);
  }
}

@keyframes anim-card-fade-scale {
  0% {
    opacity: 0;
    transform: scale(1.2);
  }

  50% {
    opacity: 1;
    transform: scale(1);
  }

  100% {
    opacity: 0;
    transform: scale(0.8);
  }
}

.anim-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.anim-card {
  padding: 4px;
  cursor: pointer;
  outline: 1px solid var(--el-border-color);
  border-radius: var(--radius-md);
  transition: outline-color var(--duration-fast) var(--ease-standard);

  &:hover,
  &.is-active {
    outline: 2px solid var(--el-color-primary);
  }

  &__stage {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 40px;
    overflow: hidden;
    background: var(--el-fill-color-light);
    border-radius: var(--radius-sm);
  }

  &__block {
    width: 30px;
    height: 20px;
    background: var(--el-color-primary);
    border-radius: var(--radius-xs);

    /* 常驻循环播放（vben 口径：所有预览块实时演示各自动效，无需 hover / 重选触发）；
       none 预设无 animation-name，方块保持静止 */
    animation-duration: 3s;
    animation-timing-function: var(--ease-standard);
    animation-iteration-count: infinite;
  }

  &__block--fade-transform {
    animation-name: anim-card-fade-transform;
  }

  &__block--fade-slide {
    animation-name: anim-card-fade-slide;
  }

  &__block--fade-up {
    animation-name: anim-card-fade-up;
  }

  &__block--fade-down {
    animation-name: anim-card-fade-down;
  }

  &__block--fade-scale {
    animation-name: anim-card-fade-scale;
  }

  &__label {
    display: block;
    padding-top: 4px;
    font-size: var(--font-size-sm);
    color: var(--el-text-color-regular);
    text-align: center;
  }
}
</style>
