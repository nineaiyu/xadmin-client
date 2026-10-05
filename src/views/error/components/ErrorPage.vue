<script lang="ts" setup>
import type { Component } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

/**
 * 错误页公共骨架：插画 + 大标题（状态码/文案）+ 说明 + 「返回首页」主按钮。
 *
 * 403/404/500 传 `code` + `textKey` 即可（三段渐入动效内建）；
 * module-disabled 变体：`motion: false` 关闭动效、`#tip` 定制说明
 * （附加模块名标注）、`#actions` 追加次级按钮。
 */
const props = withDefaults(
  defineProps<{
    /** 状态插画（`?component` 引入的 svg 组件） */
    svg: Component;
    /** 大标题：状态码数字或文案 */
    code: string;
    /** 说明文案的 i18n key（使用 #tip 插槽定制说明时可省略） */
    textKey?: string;
    /** 是否启用三段渐入动效 */
    motion?: boolean;
  }>(),
  { motion: true }
);

const router = useRouter();
const { t } = useI18n();

/** 关闭动效时初始即终态：无位移/透明度变化，与不挂 v-motion 视觉一致 */
const enterFor = (delay: number) =>
  props.motion
    ? { opacity: 1, y: 0, transition: { delay } }
    : { opacity: 1, y: 0 };
const initialFor = () =>
  props.motion ? { opacity: 0, y: 100 } : { opacity: 1, y: 0 };
</script>

<template>
  <div class="flex-c h-160">
    <component :is="svg" />
    <div class="ml-12">
      <p
        v-motion
        :enter="enterFor(80)"
        :initial="initialFor()"
        class="font-medium text-4xl mb-4! dark:text-white"
      >
        {{ code }}
      </p>
      <p
        v-motion
        :enter="enterFor(120)"
        :initial="initialFor()"
        class="mb-4! text-(--el-text-color-regular)"
      >
        <slot name="tip">{{ textKey ? t(textKey) : "" }}</slot>
      </p>
      <el-button
        v-motion
        :enter="enterFor(160)"
        :initial="initialFor()"
        type="primary"
        @click="router.push('/')"
      >
        {{ t("error.goBack") }}
      </el-button>
      <slot name="actions" />
    </div>
  </div>
</template>
