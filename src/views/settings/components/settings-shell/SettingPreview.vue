<script lang="ts" setup>
import { ref } from "vue";

defineOptions({
  name: "SettingPreview"
});

/**
 * 设置页预览卡片：标题 / 操作 / 预览舞台 / 说明脚注共用一套骨架。
 *
 * 卡片与 SettingItem 表单同为 760px 宽，预览区与表单控件列对齐；
 * 舞台固定高度，切换预览内容（题型 / 开关状态）时不会上下跳动；
 * 消费方需要把水印画布挂到舞台上时，通过 ref 读取暴露的 `stageEl`。
 */
withDefaults(
  defineProps<{
    title: string;
    /** 脚注说明（预览口径、不会提交验证等） */
    tip?: string;
    loading?: boolean;
    /** 无内容可展示（加载失败 / 开关关闭）时显示占位文案 */
    empty?: boolean;
    emptyText?: string;
    emptyTestid?: string;
    /** 风险提示（如当前页不在水印生效范围），显示在脚注上方 */
    note?: string;
    noteTestid?: string;
    /** 舞台固定高度（CSS 值），避免切换内容时高度抖动 */
    height?: string;
    /** 舞台是否留内边距；水印等铺满型预览传 false */
    padded?: boolean;
    /** 舞台的 data-testid 锚点 */
    testid?: string;
  }>(),
  {
    tip: "",
    loading: false,
    empty: false,
    emptyText: "",
    emptyTestid: undefined,
    note: "",
    noteTestid: undefined,
    height: undefined,
    padded: true,
    testid: undefined
  }
);

const stageEl = ref<HTMLElement>();
defineExpose({ stageEl });
</script>

<template>
  <section class="setting-preview">
    <header class="setting-preview__head">
      <h4 class="setting-preview__title">{{ title }}</h4>
      <div v-if="$slots.actions" class="setting-preview__actions">
        <slot name="actions" />
      </div>
    </header>
    <div
      ref="stageEl"
      v-loading="loading"
      class="setting-preview__stage"
      :class="{ 'setting-preview__stage--plain': !padded }"
      :style="height ? { height } : undefined"
      :data-testid="testid"
    >
      <p v-if="empty" class="setting-preview__empty" :data-testid="emptyTestid">
        {{ emptyText }}
      </p>
      <slot v-else />
    </div>
    <footer v-if="tip || note" class="setting-preview__footer">
      <p v-if="note" class="setting-preview__note" :data-testid="noteTestid">
        {{ note }}
      </p>
      <p v-if="tip" class="setting-preview__tip">{{ tip }}</p>
    </footer>
  </section>
</template>

<style lang="scss" scoped>
.setting-preview {
  box-sizing: border-box;
  max-width: 760px;
  margin-bottom: var(--space-5);
  overflow: hidden;
  background-color: var(--el-bg-color);
  border: var(--card-border);
  border-radius: var(--radius-lg);
}

.setting-preview__head {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--divider);
}

.setting-preview__title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.setting-preview__actions {
  display: flex;
  flex: none;
  gap: var(--space-3);
  align-items: center;
}

/* 点阵底纹表示「预览画布」：内层组件自带边框时不会再形成双层灰色方块 */
.setting-preview__stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  overflow: hidden;
  background-color: var(--el-bg-color);
  background-image: radial-gradient(
    var(--el-border-color-lighter) 1px,
    transparent 1px
  );
  background-size: 12px 12px;
}

/* 铺满型舞台（水印画布绝对定位覆盖）只去掉内边距，空状态仍然居中 */
.setting-preview__stage--plain {
  padding: 0;
}

.setting-preview__empty {
  font-size: var(--font-size-sm);
  color: var(--el-text-color-secondary);
}

.setting-preview__footer {
  padding: var(--space-2) var(--space-4) var(--space-3);
  border-top: 1px solid var(--divider);
}

.setting-preview__note {
  font-size: var(--font-size-xs);
  line-height: 20px;
  color: var(--el-color-warning);
}

.setting-preview__tip {
  font-size: var(--font-size-xs);
  line-height: 20px;
  color: var(--el-text-color-secondary);
}
</style>
