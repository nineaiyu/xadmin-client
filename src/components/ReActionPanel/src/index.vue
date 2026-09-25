<script lang="ts" setup>
import type { PanelActionGroup } from "./types";

/**
 * 实体管理面板（抽屉内容骨架）：资料区 + 基础信息 + 分组动作。
 *
 * 列表页把行操作从操作列收敛进抽屉时的统一形态：`#profile` 插槽承载页面自己的
 * 资料卡（头像/状态标签等），`metaItems` 承载 label/value 两列信息，
 * `groups` 承载按语义分组的动作按钮（整行可点，危险动作红色语义）。
 * 首个消费方为用户管理页（页面私有实现，可切换过来）；集成系三页共用本组件。
 */
defineOptions({ name: "ReActionPanel" });

interface Props {
  /** 动作分组（权限缺失的动作与随之变空的分组由调用方在构建期剔除） */
  groups: PanelActionGroup[];
  /** 基础信息（两列网格）；为空则不渲染该区块 */
  metaItems?: Array<{ key: string; label: string; value: string }>;
}

withDefaults(defineProps<Props>(), {
  metaItems: () => []
});
</script>

<template>
  <div class="re-action-panel">
    <!-- 资料区：页面自绘，卡片样式由本组件统一 -->
    <div v-if="$slots.profile" class="panel-card">
      <slot name="profile" />
    </div>

    <!-- 基础信息 -->
    <dl v-if="metaItems.length" class="meta-grid">
      <div v-for="item in metaItems" :key="item.key" class="meta-item">
        <dt class="meta-label">{{ item.label }}</dt>
        <dd class="meta-value">{{ item.value }}</dd>
      </div>
    </dl>

    <!-- 动作分组：整行可点 -->
    <div v-for="group in groups" :key="group.key" class="action-group">
      <div class="group-title">{{ group.title }}</div>
      <button
        v-for="action in group.actions"
        :key="action.code"
        type="button"
        class="action-item"
        :class="`action-item--${action.type ?? 'primary'}`"
        :disabled="action.disabled ? action.disabled() : false"
        :data-action-code="action.code"
        @click="action.run()"
      >
        <span class="action-icon">
          <el-icon><component :is="action.icon" /></el-icon>
        </span>
        <span class="min-w-0 flex-1">
          <span class="action-label">{{ action.label }}</span>
          <span v-if="action.description" class="action-desc">
            {{ action.description }}
          </span>
        </span>
      </button>
    </div>

    <!-- 页面附加区（如测试结果明细） -->
    <slot />
  </div>
</template>

<style scoped lang="scss">
.re-action-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 2px 2px 12px;
}

.panel-card {
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: 10px;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 16px;
  margin: 0;
}

.meta-item {
  min-width: 0;
}

.meta-label {
  font-size: var(--el-font-size-extra-small);
  line-height: 16px;
  color: var(--el-text-color-secondary);
}

.meta-value {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--el-font-size-small);
  line-height: 20px;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.action-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-title {
  padding-left: 2px;
  font-size: var(--el-font-size-extra-small);
  line-height: 16px;
  color: var(--el-text-color-secondary);
}

.action-item {
  display: flex;
  gap: 12px;
  align-items: center;
  width: 100%;
  padding: 10px 12px;
  text-align: left;
  cursor: pointer;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  transition:
    background-color 0.2s,
    border-color 0.2s;

  &:hover:not(:disabled) {
    background: var(--el-fill-color-light);
    border-color: var(--el-color-primary-light-5);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.action-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: var(--el-font-size-medium);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 8px;
}

.action-label {
  display: block;
  font-size: var(--el-font-size-base);
  line-height: 20px;
  color: var(--el-text-color-primary);
}

.action-desc {
  display: block;
  font-size: var(--el-font-size-extra-small);
  line-height: 16px;
  color: var(--el-text-color-secondary);
}

.action-item--warning {
  .action-icon {
    color: var(--el-color-warning);
    background: var(--el-color-warning-light-9);
  }
}

.action-item--danger {
  .action-icon {
    color: var(--el-color-danger);
    background: var(--el-color-danger-light-9);
  }

  .action-label {
    color: var(--el-color-danger);
  }
}
</style>
