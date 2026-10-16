<script lang="ts" setup>
import { computed, ref } from "vue";
import ReCollapseParams from "@/components/ReCollapseParams";
import type {
  CollapseParamSchema,
  CollapseParamValues
} from "@/components/ReCollapseParams";
import type { MonitorThresholdItem } from "@/api/system/monitor";

defineOptions({ name: "MonitorThresholdForm" });

const props = defineProps<{ items: MonitorThresholdItem[] }>();

/** 参数 schema：名称取后端可读 label、说明取 help_text，初值取当前阈值（空值回落下限）；
 *  数值控件由 min/max 约束取值范围，无需额外校验 */
const params = computed<CollapseParamSchema[]>(() =>
  props.items.map(item => ({
    key: item.key,
    label: item.label,
    description: item.help_text,
    defaultValue: Number(item.value ?? item.min),
    option: { type: "number", min: item.min, max: item.max }
  }))
);

/** 阈值取值：初始化由面板按 schema 完成（已有值不覆盖），提交前逐项回读 */
const values = ref<CollapseParamValues>({});

/** 面板未初始化的键回落到当前阈值 / 下限，避免清空输入后提交空值 */
const getPayload = (): Record<string, number> => {
  const payload: Record<string, number> = {};
  for (const item of props.items) {
    payload[item.key] = Number(
      values.value[item.key] ?? item.value ?? item.min
    );
  }
  return payload;
};

defineExpose({ getPayload });
</script>

<template>
  <ReCollapseParams
    v-model:value="values"
    :params="params"
    :visible-count="props.items.length"
  />
</template>
