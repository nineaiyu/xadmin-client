<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { VueFlow, useVueFlow } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import type { NodeRow } from "./flowConfig";

/**
 * 流程分支画布（ADR-016 §4，@vue-flow）：
 * - 节点卡 = 审批节点（名称 + 审批人摘要），位置存 layout（拖动后经 syncLayout 回写）；
 * - 条件边 = 节点出口路由 routes（一条边一条 route，animated），线性默认推进不画边；
 * - 分支的增删改在列表模式的「分支」编辑器完成，画布负责可视化与布局，保持实现轻薄。
 */
const props = defineProps<{ nodes: NodeRow[] }>();

const { t } = useI18n();

const flowNodes = computed(() =>
  props.nodes.map((row, index) => ({
    id: String(index + 1),
    position: {
      x: row.layout?.x ?? (index % 2) * 260,
      y: row.layout?.y ?? Math.floor(index / 2) * 110
    },
    data: {
      label: `${index + 1}. ${row.name || t("systemApprovalFlow.nodeName")}`,
      meta: `${row.approve_type === "RATIO" ? `RATIO ${row.approve_ratio}%` : row.approve_type} · ${row.assignee_type}: ${
        row.assignee_value || "-"
      }`
    }
  }))
);

const flowEdges = computed(() => {
  const edges = [];
  props.nodes.forEach((row, index) => {
    (row.routes || []).forEach((route, routeIndex) => {
      const condition = route.condition || {};
      const summary = condition.field
        ? `${condition.field} ${condition.op} ${condition.value ?? ""}`
        : t("systemApprovalFlow.routeAlways");
      edges.push({
        id: `r-${index + 1}-${routeIndex}-${route.target}`,
        source: String(index + 1),
        target: String(route.target),
        label: summary,
        animated: true
      });
    });
  });
  return edges;
});

// 拖动由 vue-flow 内部消化；保存前由父组件调 syncLayout 把坐标写回 NodeRow.layout
const { getNodes } = useVueFlow();

function syncLayout() {
  getNodes.value.forEach(node => {
    const row = props.nodes[Number(node.id) - 1];
    if (row) {
      row.layout = {
        x: Math.round(node.position.x),
        y: Math.round(node.position.y)
      };
    }
  });
}

defineExpose({ syncLayout });
</script>

<template>
  <div class="h-120 w-full border border-(--el-border-color) rounded">
    <VueFlow :nodes="flowNodes" :edges="flowEdges" fit-view-on-init>
      <Background />
    </VueFlow>
  </div>
</template>

<style lang="scss" scoped>
:deep(.vue-flow__node) {
  font-size: 12px;
}
</style>
