<script lang="ts" setup>
import { ref } from "vue";

/**
 * 受控 iframe：统一沙箱与 Referer 策略。
 *
 * 业务页不得直接写 `<iframe>`：路由页 / 文件预览 / 大屏自定义 HTML 三处入口
 * 的 sandbox 与 referrerpolicy 必须同源，否则新入口很容易漏掉其中之一。
 */
defineOptions({ name: "SafeFrame" });

withDefaults(
  defineProps<{
    src: string;
    title?: string;
    sandbox?: string;
    referrerpolicy?: ReferrerPolicy;
    loading?: "eager" | "lazy";
    allow?: string;
    allowfullscreen?: boolean;
  }>(),
  {
    title: "embedded-content",
    sandbox: "allow-scripts allow-same-origin allow-forms allow-popups",
    referrerpolicy: "strict-origin-when-cross-origin",
    loading: "lazy",
    allow: "",
    allowfullscreen: false
  }
);

const frame = ref<HTMLIFrameElement>();
defineExpose({ frame });
</script>

<template>
  <iframe
    ref="frame"
    :src="src"
    :title="title"
    :sandbox="sandbox"
    :referrerpolicy="referrerpolicy"
    :loading="loading"
    :allow="allow || undefined"
    :allowfullscreen="allowfullscreen"
  />
</template>
