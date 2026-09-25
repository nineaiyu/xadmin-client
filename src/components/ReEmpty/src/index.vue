<script lang="ts" setup>
import { computed } from "vue";

// 深路径导入本地图标渲染（随包注册 + 图标集懒加载）；不走 ReIcon/index 聚合出口——
// ReIcon 的 Select 组件复用本组件，经聚合出口会形成「ReIcon/index ↔ Select ↔ ReEmpty」循环依赖
import LocalIcon from "@/components/ReIcon/src/localIcon";

/**
 * 统一空态：图标底托 + 主文案 + 次级提示 + 行动插槽。
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
    /** 图标名（离线图标集可用名，见 components/ReIcon/src/offlineIcon.ts） */
    icon?: string;
  }>(),
  {
    description: "",
    hint: "",
    size: "default",
    icon: "ep/box"
  }
);

const imageSize = computed(() => (props.size === "small" ? 44 : 64));
</script>

<template>
  <el-empty :description="description" :image-size="imageSize">
    <template #image>
      <div class="re-empty-art" :class="`re-empty-art--${size}`">
        <LocalIcon :icon="icon" />
      </div>
    </template>
    <p v-if="hint" class="re-empty-hint">{{ hint }}</p>
    <slot />
  </el-empty>
</template>

<style lang="scss" scoped>
/* 图标底托：主题色浅底 + 主题色图标（`light-8` 档底托在浅色卡片上可辨识；
   暗色下 EP 会把 light 档重定义为深色适配值，深浅两态自动跟随）。
   EP 对 `.el-empty__image` 内的 svg 用 `--el-svg-monochrome-grey`（#dcdfe6）着色且
   权重 0-2-1 压过继承色，故在此重定义该变量使图标跟随主题主色 */
.re-empty-art {
  --el-svg-monochrome-grey: var(--el-color-primary);

  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-8);
  border-radius: 50%;

  &--default {
    width: 76px;
    height: 76px;
    font-size: 34px;
  }

  &--small {
    width: 56px;
    height: 56px;
    font-size: 26px;
  }
}

.re-empty-hint {
  margin-top: -8px;
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}
</style>
