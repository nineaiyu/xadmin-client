<script lang="ts" setup>
import { ref } from "vue";
import { useWebhookSubscription } from "../../subscription/utils/hook";
import { useWebhookDelivery } from "../../delivery/utils/hook";

/**
 * Webhook 家族通用列表页内层：订阅（WebhookSubscription）与投递
 * （WebhookDelivery）两页原是逐字同构的 RePlusPage 薄壳，差异只有
 * hook 装配与工具栏按钮——mode 驱动取哪份 hook 装配，对外组件名与
 * 渲染结果保持不变（权限/菜单映射依赖页面组件名，不在本组件收敛）。
 */
const props = defineProps<{ mode: "subscription" | "delivery" }>();

const tableRef = ref();
const config =
  props.mode === "subscription"
    ? useWebhookSubscription(tableRef)
    : useWebhookDelivery(tableRef);

// 工具栏按钮仅订阅页装配（新建入口）；投递页只读 + 行内重试，无工具栏
const tableBarButtonsProps =
  "tableBarButtonsProps" in config ? config.tableBarButtonsProps : undefined;
</script>

<template>
  <RePlusPage
    ref="tableRef"
    :api="config.api"
    :auth="config.auth"
    locale-name="webhook"
    :selection="false"
    :listColumnsFormat="config.listColumnsFormat"
    :operationButtonsProps="config.operationButtonsProps"
    :tableBarButtonsProps="tableBarButtonsProps"
  />
</template>
