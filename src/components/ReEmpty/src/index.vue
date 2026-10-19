<script lang="ts" setup>
import { computed } from "vue";

// 深路径导入本地图标渲染（随包注册 + 图标集懒加载）；不走 ReIcon/index 聚合出口——
// ReIcon 的 Select 组件复用本组件，经聚合出口会形成「ReIcon/index ↔ Select ↔ ReEmpty」循环依赖
import LocalIcon from "@/components/ReIcon/src/localIcon";

import EmptyArt from "./EmptyArt.vue";

/**
 * 统一空态：内置插画 + 主文案 + 次级提示 + 行动插槽。
 *
 * 默认使用主题色绘制的「空白记录」插画（浅色 / 暗色自动跟随）；需要语义化图标
 * （如加载失败用 `ep/warning`）时传 `icon`，切换为柔光图标形态。
 *
 * 内部仍基于 `el-empty`（保留 `.el-empty` / description 文本结构，
 * 既有用例的 `getByText` 与 `.el-empty` 联合选择器断言零改动）。
 */
defineOptions({ name: "ReEmpty" });

const props = withDefaults(
  defineProps<{
    /** 主文案（等价 el-empty 的 description） */
    description?: string;
    /** 次级提示（一行补充说明，可选） */
    hint?: string;
    /** 尺寸档位：small 用于面板/侧栏内嵌，default 用于页面级 */
    size?: "small" | "default";
    /** 语义化图标名（离线图标集可用名，见 components/ReIcon/src/offlineIcon.ts） */
    icon?: string;
    /** 插画尺寸覆盖（px，等价 `el-empty` 的 image-size）；0 = 跟随 size 档位 */
    imageSize?: number;
  }>(),
  {
    description: "",
    hint: "",
    size: "default",
    icon: "",
    imageSize: 0
  }
);

/** 插画容器边长：显式传入优先，否则按档位（与既有页面传 image-size 的意图一致） */
const artSize = computed(
  () => props.imageSize || (props.size === "small" ? 44 : 64)
);
</script>

<template>
  <el-empty :description="description" :image-size="artSize">
    <template #image>
      <div
        class="re-empty-art"
        :class="[`re-empty-art--${size}`, { 're-empty-art--icon': !!icon }]"
      >
        <LocalIcon v-if="icon" class="re-empty-art__icon" :icon="icon" />
        <EmptyArt v-else />
      </div>
    </template>
    <p v-if="hint" class="re-empty-hint">{{ hint }}</p>
    <slot />
  </el-empty>
</template>

<style lang="scss" scoped>
/* EP 对 `.el-empty__image` 内的 svg 用 `--el-svg-monochrome-grey`（#dcdfe6）着色且
   权重压过继承色，故在此重定义该变量使插画 / 图标跟随主题主色 */
.re-empty-art {
  --el-svg-monochrome-grey: var(--el-color-primary);

  /* 插画纸张底色：宿主页面可整块覆盖（如大屏恒深色页） */
  --re-empty-sheet-bg: var(--el-fill-color-blank);

  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--el-color-primary);

  /* 图标形态：柔光圆底替代旧的实心浅色方块，避免小尺寸下「色块 + 粗图标」发闷 */
  &--icon {
    background: radial-gradient(
      circle at 50% 48%,
      var(--el-color-primary-light-8) 0%,
      transparent 68%
    );
  }

  &__icon {
    font-size: var(--display-size-md);
  }

  &--small &__icon {
    font-size: var(--display-size-sm);
  }
}

.re-empty-hint {
  margin-top: -8px;
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}
</style>
