<script lang="ts" setup>
import { computed, type Component } from "vue";
import { useRoute, useRouter } from "vue-router";
import { usePreferredReducedMotion } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { goBackOrHome, hasInAppHistory } from "@/router/utils";
import { message } from "@/utils/message";

/**
 * 错误页公共骨架：插画 + 大标题（状态码/文案）+ 说明 + 「返回」主按钮。
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
const route = useRoute();
const { t } = useI18n();
/** 是否有站内上一页：决定返回按钮的落点与文案（直达进入时回首页） */
const canBack = hasInAppHistory(router);
const reducedMotion = usePreferredReducedMotion();
/** 系统「减少动效」优先于页面开关 */
const motionOn = computed(
  () => props.motion && reducedMotion.value !== "reduce"
);
const detail = computed(() => String(route.query.detail ?? ""));
const requestId = computed(() => String(route.query.requestId ?? ""));

/** 关闭动效时初始即终态：无位移/透明度变化，与不挂 v-motion 视觉一致 */
const enterFor = (delay: number) =>
  motionOn.value
    ? { opacity: 1, y: 0, transition: { delay } }
    : { opacity: 1, y: 0 };
const initialFor = () =>
  motionOn.value ? { opacity: 0, y: 100 } : { opacity: 1, y: 0 };

const copyDiagnostics = async () => {
  const lines = [`code=${props.code}`];
  if (detail.value) lines.push(`detail=${detail.value}`);
  if (requestId.value) lines.push(`requestId=${requestId.value}`);
  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    message(t("error.copied"), { type: "success" });
  } catch {
    message(t("error.copyFailed"), { type: "warning" });
  }
};
</script>

<template>
  <div class="flex-c min-h-[40rem] py-10">
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
        @click="goBackOrHome(router)"
      >
        {{ canBack ? t("error.back") : t("error.goBack") }}
      </el-button>
      <slot name="actions" />
      <div
        v-if="detail || requestId"
        class="mt-4 max-w-[560px] text-xs text-(--el-text-color-secondary)"
        data-testid="error-diagnostics"
      >
        <p v-if="detail" class="break-all">detail: {{ detail }}</p>
        <p v-if="requestId" class="break-all">requestId: {{ requestId }}</p>
        <el-button link type="primary" size="small" @click="copyDiagnostics">
          {{ t("error.copyDiagnostics") }}
        </el-button>
      </div>
    </div>
  </div>
</template>
