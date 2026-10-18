<script lang="ts" setup>
import { onMounted, ref, watch } from "vue";
import { splitValues } from "@/views/approval/utils/assigneeValues";
import type { RecordType } from "plus-pro-components";
import RuleLevelsEditor from "./RuleLevelsEditor.vue";
import { createLevelRow, type LevelRow } from "../utils/types";

/**
 * 审批级次字段（元数据表单的 renderField 适配层）：
 *
 * `RuleLevelsEditor` 是「就地增删改」的编辑器（直接改行对象、替换内部数组），
 * 配合手写表单的 reactive 数组用时父表单天然可见；作为字段渲染器时父表单拿到的
 * 是转换后的副本，因此这里用深监听把编辑结果回写为服务端载荷（数组下标即 order）。
 *
 * 对外值 = `[{order, name, approve_type, assignee_type, assignee_value}]`（与接口同形）。
 */
defineOptions({ name: "ApprovalRuleLevelsField" });

const props = defineProps<{
  modelValue?: RecordType[] | null;
}>();
const emit = defineEmits<{
  "update:modelValue": [rows: Record<string, unknown>[]];
}>();

/** 服务端级次载荷 → 编辑器行（assignee_value 逗号串拆成多选数组） */
function toRows(value: unknown): LevelRow[] {
  const list = Array.isArray(value) ? (value as RecordType[]) : [];
  const rows = list.map(level => ({
    name: String(level.name ?? ""),
    approve_type: String(level.approve_type ?? "OR"),
    assignee_type: String(level.assignee_type ?? "user"),
    assignee_value: String(level.assignee_value ?? ""),
    assignee_list: splitValues(String(level.assignee_value ?? ""))
  }));
  return rows.length ? rows : [createLevelRow()];
}

/** 编辑器行 → 服务端级次载荷（数组下标即 order） */
function toPayload(rows: LevelRow[]): Record<string, unknown>[] {
  return rows.map((row, index) => ({
    order: index + 1,
    name: row.name ?? "",
    approve_type: row.approve_type,
    assignee_type: row.assignee_type,
    assignee_value: row.assignee_value
  }));
}

const rows = ref<LevelRow[]>(toRows(props.modelValue));

// 首次挂载归一为服务端载荷形状（新建态的行带 assignee_list、无 order）
onMounted(() => emit("update:modelValue", toPayload(rows.value)));

// 编辑器就地增删改（不替换数组）也能回写父表单
watch(rows, value => emit("update:modelValue", toPayload(value)), {
  deep: true
});

// 外部值变化（编辑回显 / 表单重置）→ 重建本地行；等价则跳过，避免回写循环
watch(
  () => props.modelValue,
  value => {
    const next = toRows(value);
    if (JSON.stringify(next) === JSON.stringify(rows.value)) return;
    rows.value = next;
  },
  { deep: true }
);
</script>

<template>
  <RuleLevelsEditor v-model:levels="rows" />
</template>
