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

// 这组 props 在 hook 里以 shallowRef 承载，必须提到 setup 顶层再下传给模板：
// 模板只对顶层 ref 做自动解包，嵌套在普通对象里（config.operationButtonsProps）
// 取到的是 Ref 本身——组件侧读 .buttons / .hideDetail / .width 全落空，自定义
// 按钮与列宽设置会静默失效
const { api, auth, listColumnsFormat, operationButtonsProps } = config;

// 工具栏按钮仅订阅页装配（新建入口）；投递页只读 + 行内重试，无工具栏
const tableBarButtonsProps =
  "tableBarButtonsProps" in config ? config.tableBarButtonsProps : undefined;
</script>

<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="webhook"
    :selection="false"
    :list-columns-format="listColumnsFormat"
    :operation-buttons-props="operationButtonsProps"
    :table-bar-buttons-props="tableBarButtonsProps"
  />
</template>
