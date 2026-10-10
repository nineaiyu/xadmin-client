<script lang="ts" setup>
// 设置面板区块：卡片容器（图标 + 标题 + 帮助提示 + 可选说明），
// `list` 时以 ul.setting 承载行组件（E2E 契约选择器），`flush` 供纯预览内容去掉行内边距
import type { Component } from "vue";
import { Z_INDEX } from "@/utils/zIndex";
import QuestionLine from "~icons/ri/question-line";

withDefaults(
  defineProps<{
    title: string;
    tip?: string;
    desc?: string;
    icon?: Component;
    list?: boolean;
    flush?: boolean;
  }>(),
  { tip: "", desc: "", icon: undefined, list: false, flush: false }
);
</script>

<template>
  <section class="pref-block">
    <header class="pref-block__head">
      <span v-if="icon" class="pref-block__icon">
        <IconifyIconOffline :icon="icon" />
      </span>
      <span class="pref-block__title">
        {{ title }}
        <el-tooltip
          v-if="tip"
          :content="tip"
          placement="top"
          :z-index="Z_INDEX.tippy"
        >
          <IconifyIconOffline :icon="QuestionLine" class="pref-block__tip" />
        </el-tooltip>
      </span>
    </header>
    <p v-if="desc" class="pref-block__desc">{{ desc }}</p>
    <ul v-if="list" :class="['setting', { 'setting--flush': flush }]">
      <slot />
    </ul>
    <div v-else class="pref-block__body">
      <slot />
    </div>
  </section>
</template>

<style lang="scss" scoped>
.pref-block {
  padding: 12px 12px 8px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-extra-light);
  border-radius: var(--radius-lg);

  & + & {
    margin-top: 12px;
  }

  &__head {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  &__icon {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    font-size: 13px;
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
    border-radius: var(--radius-sm);
  }

  &__title {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    font-size: var(--font-size-base);
    font-weight: 600;
    line-height: 22px;
    color: var(--el-text-color-primary);
  }

  &__tip {
    font-size: var(--font-size-md);
    color: var(--el-text-color-placeholder);
    cursor: help;
  }

  &__desc {
    margin: 2px 0 0;
    font-size: var(--font-size-xs);
    line-height: var(--line-height-normal);
    color: var(--el-text-color-secondary);
  }

  &__body {
    margin-top: 8px;
  }

  .setting {
    margin: 4px -6px -2px;
  }

  .setting--flush {
    margin: 8px 0 0;
  }
}
</style>
