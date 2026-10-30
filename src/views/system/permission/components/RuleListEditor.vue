<script lang="ts" setup>
import ReEmpty from "@/components/ReEmpty";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import AddFill from "~icons/ri/add-circle-line";
import EditPen from "~icons/ep/edit-pen";
import CopyDocument from "~icons/ri/file-copy-line";
import Delete from "~icons/ep/delete";
import RuleEditForm from "./RuleEditForm.vue";
import TrialPanel from "./TrialPanel.vue";
import {
  RULE_PRESETS,
  ruleTypeOption,
  ruleValueInput,
  type RulePreset
} from "./utils/ruleMeta";
import {
  buildFieldIndex,
  describeRule,
  type RuleDescribeContext
} from "./utils/ruleSummary";
import {
  appendRule,
  copyRule,
  removeRule,
  replaceRule,
  stripRuleIds,
  withRuleIds,
  type EditableRule
} from "./utils/ruleRows";
import type {
  FieldLookupItem,
  FieldLookupNode,
  FieldRuleRow
} from "./utils/types";

defineOptions({ name: "PermissionRuleListEditor" });

interface Props {
  dataList?: FieldRuleRow[];
  valuesData?: FieldLookupItem[];
  /** 数据权限字段树（试算模型候选 + 字段中文名） */
  ruleList?: FieldLookupNode[];
  /** 字段权限注册表（ROLE）树：字段试算草稿候选 */
  fieldRuleList?: FieldLookupNode[];
  /** 菜单上下文候选（试算用） */
  menus?: Array<{ value: string; label: string }>;
  /** 当前表单值（试算读 mode_type / menu，保证草稿与保存同语义） */
  formValue?: unknown;
  /** 匹配符中文文案（后端 choices 下发，与预览解码同源） */
  matchTexts?: Record<string, string>;
}

const props = withDefaults(defineProps<Props>(), {
  dataList: () => [],
  valuesData: () => [],
  ruleList: () => [],
  fieldRuleList: () => [],
  menus: () => [],
  matchTexts: () => ({})
});

const emit = defineEmits<{ change: [rules: FieldRuleRow[]] }>();

const { t } = useI18n();

const rules = ref<EditableRule[]>([]);
/** 编辑中的行稳定身份；null 表示不在编辑既有行 */
const editingRid = ref<number | null>(null);
/** 新增规则卡片（编辑身份与既有行互斥） */
const creating = ref(false);
const draft = ref<FieldRuleRow>({
  table: "*",
  field: "",
  match: "",
  type: "",
  value: ""
});

/** 字段索引：`表.字段` → 中文标签 */
const fieldIndex = computed(() => buildFieldIndex(props.ruleList));

/** 取值方式可读名：优先「过滤语义」文案（hint），回退选项标签 */
function typeLabel(type?: string): string {
  const item = ruleTypeOption(props.valuesData, type);
  return item?.hint || item?.label || type || "";
}

function matchLabel(match?: string): string {
  return props.matchTexts[match ?? ""] ?? match ?? "";
}

function humanizeSeconds(seconds: number): string {
  const abs = Math.abs(seconds) || 0;
  const unit =
    abs !== 0 && abs % 86400 === 0
      ? String(86400)
      : abs !== 0 && abs % 3600 === 0
        ? String(3600)
        : String(60);
  return t("systemPermission.editor.secondsValue", {
    count: abs / Number(unit),
    unit: t(`systemPermission.editor.secondsUnit.${unit}`)
  });
}

const describeCtx = computed<RuleDescribeContext>(() => ({
  fieldLabel: (table, field) => {
    if (table === "*" && field === "*") {
      return t("systemPermission.editor.anyField");
    }
    const label = fieldIndex.value.get(`${table}.${field}`);
    if (label) return label;
    return field === "*"
      ? t("systemPermission.editor.anyField")
      : `${table}.${field}`;
  },
  tableLabel: table =>
    !table || table === "*"
      ? t("systemPermission.editor.anyTable")
      : (fieldIndex.value.get(String(table)) ?? String(table)),
  typeLabel,
  matchLabel,
  objectText: count =>
    t("systemPermission.editor.summaryObjectCount", { count }),
  secondsText: seconds => humanizeSeconds(seconds),
  valueText: value => String(value ?? ""),
  allText: t("systemPermission.editor.summaryAll"),
  includeText: t("systemPermission.editor.summaryInclude"),
  excludeText: t("systemPermission.editor.summaryExclude")
}));

function describe(rule: FieldRuleRow): string {
  const option = ruleTypeOption(props.valuesData, rule.type);
  return describeRule(
    rule,
    ruleValueInput(rule.type, option),
    describeCtx.value
  );
}

/**
 * 与表单值的双向同步守卫：外部回写的值与上次上抛的一致时不再重置内部状态，
 * 避免「emit → 表单值更新 → props 变化 → 再 emit」的循环（编辑态会被打断）。
 */
let lastEmitted = "";

watch(
  () => props.dataList,
  value => {
    const next = withRuleIds(value ?? []);
    if (JSON.stringify(stripRuleIds(next)) === lastEmitted) return;
    // 外部整体替换：旧身份作废，编辑中的草稿不能落到新数据上
    rules.value = next;
    editingRid.value = null;
    creating.value = false;
  },
  { immediate: true }
);

watch(
  rules,
  value => {
    const payload = stripRuleIds(value);
    lastEmitted = JSON.stringify(payload);
    emit("change", payload);
  },
  { deep: true }
);

function emptyRule(type = "", match = ""): FieldRuleRow {
  return { table: "", field: "", match, type, value: "" };
}

function isEditing(rule: EditableRule): boolean {
  return editingRid.value === rule._rid;
}

function handleAdd() {
  draft.value = emptyRule();
  creating.value = true;
  editingRid.value = null;
}

function handleEdit(rule: EditableRule) {
  const { _rid, ...source } = rule;
  draft.value = source;
  editingRid.value = _rid;
  creating.value = false;
}

function handleCopy(rule: EditableRule) {
  rules.value = copyRule(rules.value, rule._rid);
}

function handleRemove(rule: EditableRule) {
  rules.value = removeRule(rules.value, rule._rid);
  // 编辑中的行被删除：草稿随之作废，避免提交时覆盖到别的规则
  if (isEditing(rule)) handleCancelEdit();
}

function handleCancelEdit() {
  editingRid.value = null;
  creating.value = false;
}

function handleSubmitEdit() {
  if (creating.value) {
    rules.value = appendRule(rules.value, draft.value);
  } else if (editingRid.value !== null) {
    rules.value = replaceRule(rules.value, editingRid.value, draft.value);
  }
  editingRid.value = null;
  creating.value = false;
}

/** 常用模板：只预置类型与匹配符；「全部数据」直接落成完整规则 */
function applyPreset(preset: RulePreset) {
  if (preset.wildcard) {
    const exists = rules.value.some(rule => rule.type === preset.type);
    if (!exists) {
      rules.value = appendRule(rules.value, {
        table: "*",
        field: "*",
        match: "all",
        exclude: false,
        type: preset.type,
        value: "*"
      });
    }
    return;
  }
  draft.value = emptyRule(preset.type, preset.match);
  creating.value = true;
  editingRid.value = null;
}

/** 试算面板只消费纯规则行（编辑器内部身份不外泄） */
const plainRules = computed(() => stripRuleIds(rules.value));
</script>

<template>
  <section class="rule-editor">
    <header class="rule-editor-head">
      <div class="flex items-center gap-2">
        <span class="rule-editor-title">{{ t("systemPermission.rules") }}</span>
        <el-tag round size="small" type="info">{{ rules.length }}</el-tag>
        <el-popover :width="380" placement="bottom-start" trigger="click">
          <div class="rule-notes">
            <p>{{ t("systemPermission.notes.rules") }}</p>
            <p>{{ t("systemPermission.notes.priority") }}</p>
            <p>{{ t("systemPermission.notes.scope") }}</p>
          </div>
          <template #reference>
            <el-button link size="small" type="primary">
              {{ t("systemPermission.notes.title") }}
            </el-button>
          </template>
        </el-popover>
      </div>
      <el-button
        v-if="!creating && editingRid === null"
        data-testid="rule-add"
        :icon="useRenderIcon(AddFill)"
        size="small"
        type="primary"
        @click="handleAdd"
      >
        {{ t("systemPermission.editor.addRule") }}
      </el-button>
    </header>

    <div class="rule-editor-presets">
      <span class="rule-editor-preset-label">{{
        t("systemPermission.presets")
      }}</span>
      <el-button
        v-for="preset in RULE_PRESETS"
        :key="preset.key"
        plain
        size="small"
        @click="applyPreset(preset)"
      >
        {{ t(`systemPermission.preset_${preset.key}`) }}
      </el-button>
    </div>

    <div v-if="rules.length || creating" class="rule-list">
      <div
        v-for="(rule, index) in rules"
        :key="rule._rid"
        class="rule-row"
        data-testid="rule-row"
        :class="{ 'is-editing': isEditing(rule) }"
      >
        <RuleEditForm
          v-if="isEditing(rule)"
          :key="rule._rid"
          :field-lookups-data="ruleList"
          :model-value="draft"
          :values-data="valuesData"
          @cancel="handleCancelEdit"
          @submit="handleSubmitEdit"
          @update:model-value="draft = $event"
        />
        <template v-else>
          <div class="rule-row-main">
            <span class="rule-row-index">{{ index + 1 }}</span>
            <span class="rule-row-summary">{{ describe(rule) }}</span>
            <el-tag effect="plain" size="small">{{
              typeLabel(rule.type)
            }}</el-tag>
          </div>
          <div class="rule-row-actions">
            <el-button
              :aria-label="t('buttons.edit')"
              :icon="useRenderIcon(EditPen)"
              link
              size="small"
              type="primary"
              @click="handleEdit(rule)"
            />
            <el-button
              v-tippy="t('systemPermission.copyRule')"
              :aria-label="t('systemPermission.copyRule')"
              :icon="useRenderIcon(CopyDocument)"
              link
              size="small"
              type="primary"
              @click="handleCopy(rule)"
            />
            <el-popconfirm
              :title="t('buttons.confirmDelete')"
              @confirm="handleRemove(rule)"
            >
              <template #reference>
                <el-button
                  :aria-label="t('buttons.delete')"
                  :icon="useRenderIcon(Delete)"
                  link
                  size="small"
                  type="danger"
                />
              </template>
            </el-popconfirm>
          </div>
        </template>
      </div>

      <div v-if="creating" class="rule-row is-editing">
        <RuleEditForm
          :key="`new-${rules.length}`"
          :field-lookups-data="ruleList"
          :model-value="draft"
          :values-data="valuesData"
          @cancel="handleCancelEdit"
          @submit="handleSubmitEdit"
          @update:model-value="draft = $event"
        />
      </div>
    </div>

    <ReEmpty
      v-else
      :description="t('systemPermission.editor.emptyRules')"
      :image-size="72"
    />

    <!-- 即时试算：用当前未保存的规则草稿验证影响面（不落库） -->
    <TrialPanel
      :field-rule-list="fieldRuleList"
      :form-value="formValue"
      :menus="menus"
      :rule-list="ruleList"
      :rules="plainRules"
    />
  </section>
</template>

<style lang="scss" scoped>
.rule-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rule-editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.rule-editor-title {
  font-size: var(--el-font-size-base);
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.rule-editor-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.rule-editor-preset-label {
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-secondary);
}

.rule-notes p {
  margin: 0 0 8px;
  font-size: var(--el-font-size-small);
  line-height: 1.6;
  color: var(--el-text-color-regular);
}

.rule-notes p:last-child {
  margin-bottom: 0;
}

.rule-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rule-row {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-lg);
  transition: border-color var(--duration-fast) var(--ease-standard);
}

.rule-row:hover {
  border-color: var(--el-color-primary-light-5);
}

.rule-row.is-editing {
  display: block;
  padding: 0;
  background: transparent;
  border: none;
}

.rule-row-main {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
}

.rule-row-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color);
  border-radius: 50%;
}

.rule-row-summary {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.rule-row-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
}
</style>
