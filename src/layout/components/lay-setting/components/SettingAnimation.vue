<script lang="ts" setup>
// 系统设置面板「通用」：页面切换动画（预览卡片常驻循环播放，
// 无需重新触发即可实时看到每个预设的动效）。
// 预设清单与 style/transition.scss 的过渡类名前缀一一对应，none = 关闭过渡。
import type { Component } from "vue";
import { computed } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import { useConfigureStorage } from "../hooks/useConfigureStorage";
import PrefBlock from "./PrefBlock.vue";
import PrefRow from "./PrefRow.vue";

import ArrowDownLine from "~icons/ri/arrow-down-line";
import ArrowLeftRightLine from "~icons/ri/arrow-left-right-line";
import ArrowRightLine from "~icons/ri/arrow-right-line";
import ArrowUpLine from "~icons/ri/arrow-up-line";
import ForbidLine from "~icons/ri/forbid-2-line";
import CheckIcon from "~icons/ep/select";
import ZoomInLine from "~icons/ri/zoom-in-line";

const { t } = useNav();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { storageConfigureChange } = useConfigureStorage();

/** 路由切换期间的顶部进度条（默认开） */
const transitionProgress = computed({
  get: () => $storage?.configure?.transitionProgress ?? true,
  set: value => storageConfigureChange("transitionProgress", value)
});

/** 路由切换期间的内容区 loading 遮罩（默认关，仅首次加载页面时点亮） */
const transitionLoading = computed({
  get: () => $storage?.configure?.transitionLoading ?? false,
  set: value => storageConfigureChange("transitionLoading", value)
});

/** 预设清单（value 与 style/transition.scss 的类名前缀同源）；徽标图标标示位移方向 */
const PRESETS: Array<{
  value: PageTransitionType;
  labelKey: string;
  icon: Component;
}> = [
  { value: "none", labelKey: "layout.transitionNone", icon: ForbidLine },
  {
    value: "fade-transform",
    labelKey: "layout.transitionFadeTransform",
    icon: ArrowLeftRightLine
  },
  {
    value: "fade-slide",
    labelKey: "layout.transitionFadeSlide",
    icon: ArrowRightLine
  },
  { value: "fade-up", labelKey: "layout.transitionFadeUp", icon: ArrowUpLine },
  {
    value: "fade-down",
    labelKey: "layout.transitionFadeDown",
    icon: ArrowDownLine
  },
  {
    value: "fade-scale",
    labelKey: "layout.transitionFadeScale",
    icon: ZoomInLine
  }
];

const options = computed(() =>
  PRESETS.map(item => ({
    value: item.value,
    label: t(item.labelKey),
    icon: item.icon
  }))
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
    list
  >
    <PrefRow
      :label="t('layout.transitionProgress')"
      :tip="t('layout.transitionProgressTip')"
    >
      <template #control>
        <el-switch
          v-model="transitionProgress"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
    <PrefRow
      :label="t('layout.transitionLoading')"
      :tip="t('layout.transitionLoadingTip')"
    >
      <template #control>
        <el-switch
          v-model="transitionLoading"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
    <PrefRow :label="t('layout.transitionEffect')" stack>
      <template #control>
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
            <span class="anim-card__label">
              <IconifyIconOffline :icon="item.icon" class="anim-card__badge" />
              {{ item.label }}
            </span>
            <IconifyIconOffline
              v-if="pageTransition === item.value"
              :icon="CheckIcon"
              class="anim-card__mark"
            />
          </li>
        </ul>
      </template>
    </PrefRow>
  </PrefBlock>
</template>

<style lang="scss" scoped>
/* 预览关键帧按各预设的进入/离开位移等比缩小（原值见 style/transition.scss），
   形态：0% → 50% → 100% 位移穿越，中途完全可见 */
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
  position: relative;
  padding: 5px;
  cursor: pointer;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-md);
  transition:
    border-color var(--duration-fast) var(--ease-standard),
    background-color var(--duration-fast) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);

  /* 选中/悬停口径与偏好卡组（PrefChoice）一致：主色描边 + 主色浅底 + 微上浮 */
  &:hover {
    border-color: var(--el-color-primary-light-5);
    transform: translateY(-1px);
  }

  &.is-active {
    background: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary);
  }

  &__mark {
    position: absolute;
    top: 2px;
    right: 2px;
    font-size: var(--font-size-xs);
    color: var(--el-color-primary);
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

    /* 常驻循环播放（所有预览块实时演示各自动效，无需 hover / 重选触发）；
       none 预设无 animation-name，方块保持静止 */
    animation-duration: 3s;
    animation-timing-function: var(--ease-standard);
    animation-iteration-count: infinite;
  }

  /* 关闭：无动效预设，方块降饱和表达「静止」 */
  &__block--none {
    background: var(--el-fill-color-dark);
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
    display: flex;
    gap: 4px;
    align-items: center;
    justify-content: center;
    padding-top: 4px;
    font-size: var(--font-size-sm);
    color: var(--el-text-color-regular);
  }

  /* 方向徽标：静止状态下也能读出各预设的位移方向 */
  &__badge {
    font-size: var(--font-size-sm);
    color: var(--el-text-color-secondary);
  }

  &.is-active &__badge {
    color: var(--el-color-primary);
  }
}

/* 相位错开：六张卡按序各错半个周期（3s ÷ 6），同屏不再是同一相位——
   常驻播放时扫视一眼即可分辨「谁在左右滑、谁在上下滑、谁在缩放」 */
@for $i from 1 through 6 {
  .anim-grid > .anim-card:nth-child(#{$i}) .anim-card__block {
    animation-delay: ($i - 1) * -0.5s;
  }
}
</style>
