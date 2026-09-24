<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { CascaderOption } from "element-plus";
import { SUCCESS_CODE } from "@/api/types";
import { hasAuth } from "@/router/utils";
import { modelLabelFieldApi } from "@/api/system/field";
import type { FieldLookupItem, FieldLookupNode } from "./utils/types";

defineOptions({ name: "PermissionRuleFieldPicker" });

interface Props {
  /** 数据权限字段树（应用 → 模型 → 字段；含「全部表」通配节点） */
  fieldLookupsData?: FieldLookupNode[];
  /** 取值方式为「全部数据」时锁定选择（控件保留在界面上，避免字段整块消失） */
  disabled?: boolean;
  error?: string;
}

const props = withDefaults(defineProps<Props>(), {
  fieldLookupsData: () => [],
  disabled: false,
  error: ""
});

const emit = defineEmits<{
  /** 选中「全部表 + 全部字段」= 全部数据（由使用方决定是否切换取值方式） */
  wildcard: [];
}>();

/**
 * 级联路径（应用 / 模型 / 字段）：
 * - 常规字段为三段：`[应用, 模型, 字段]`；
 * - 「全部表」下的跨模型通用字段为两段：`["*", 字段]`、`["*", "*"]`（全部数据）。
 * 表与字段一律由路径末端两段派生，保证与后端 `table` / `field` 一一对应。
 */
const path = defineModel<string[]>("path", { default: () => [] });
const match = defineModel<string>("match", { default: "" });
const matchOptions = defineModel<FieldLookupItem[]>("matchOptions", {
  default: () => []
});

const { t } = useI18n();

const fieldMeta = ref<Record<string, unknown> | null>(null);

const table = computed(() => {
  const list = path.value ?? [];
  return list.length >= 2 ? list[list.length - 2] : "";
});

const field = computed(() => {
  const list = path.value ?? [];
  return list.length >= 1 ? list[list.length - 1] : "";
});

const cascaderOptions = computed(
  () => props.fieldLookupsData as unknown as CascaderOption[]
);

const fieldMetaText = computed(() => {
  const meta = fieldMeta.value;
  if (!meta) return "";
  const parts: string[] = [];
  if (meta.internal_type) parts.push(String(meta.internal_type));
  if (meta.related_model) parts.push(String(meta.related_model));
  if (meta.multiple) parts.push(t("systemPermission.editor.multipleField"));
  if (meta.null) parts.push(t("systemPermission.editor.nullableField"));
  return parts.join(" · ");
});

async function loadMatchOptions() {
  matchOptions.value = [];
  fieldMeta.value = null;
  // 「全部数据」由读取侧固定匹配，无需候选，也不改动已确定的 match
  if (props.disabled) return;
  if (!table.value || !field.value) return;
  if (!hasAuth("lookups:SystemModelLabelField")) return;
  const res = await modelLabelFieldApi
    .lookups({ table: table.value, field: field.value })
    .catch(() => null);
  if (res?.code !== SUCCESS_CODE) return;
  matchOptions.value = res.data as FieldLookupItem[];
  fieldMeta.value =
    (res as { field_meta?: Record<string, unknown> }).field_meta ?? null;
  // 字段变化后旧 match 可能已不适用（后端会拒），新列表里没有就清掉
  if (
    match.value &&
    !matchOptions.value.some(item => item.value === match.value)
  ) {
    match.value = "";
  }
}

watch(
  [table, field],
  () => {
    loadMatchOptions();
  },
  { immediate: true }
);

function handlePathChange(value: unknown) {
  const list = (value ?? []) as string[];
  // 「全部表 + 全部字段」语义上就是全部数据，交由使用方切换取值方式
  if (list.length === 2 && list[0] === "*" && list[1] === "*") {
    emit("wildcard");
  }
}
</script>

<template>
  <div class="flex flex-col gap-1" data-testid="rule-scope">
    <span class="rule-edit-label">{{
      t("systemPermission.editor.scope")
    }}</span>
    <el-cascader
      v-model="path"
      class="w-full"
      clearable
      filterable
      :disabled="disabled"
      :options="cascaderOptions"
      :placeholder="t('systemPermission.editor.scopePlaceholder')"
      :props="{ value: 'name', label: 'label', children: 'children' }"
      @change="handlePathChange"
    >
      <template #default="{ node, data }">
        <span>{{ data.label }}</span>
        <span v-show="data.parent">({{ data.name }})</span>
        <span v-show="!node.isLeaf">({{ data?.children?.length }})</span>
      </template>
    </el-cascader>
    <span v-if="error" class="rule-edit-error">{{ error }}</span>
    <span v-else-if="disabled" class="rule-edit-meta">{{
      t("systemPermission.editor.scopeLockedTip")
    }}</span>
    <span v-else-if="fieldMetaText" class="rule-edit-meta">{{
      fieldMetaText
    }}</span>
  </div>
</template>

<style lang="scss" scoped>
.rule-edit-label {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.rule-edit-error {
  font-size: 12px;
  color: var(--el-color-danger);
}

.rule-edit-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
