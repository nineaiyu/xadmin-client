<script lang="ts" setup>
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

const rules = ref<FieldRuleRow[]>([]);
/** 编辑中的行下标；等于 rules.length 表示「新增」编辑卡片 */
const editingIndex = ref(-1);
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
    const next = (value ?? []).map(rule => ({ ...rule }));
    if (JSON.stringify(next) === lastEmitted) return;
    rules.value = next;
  },
  { immediate: true }
);

watch(
  rules,
  value => {
    const payload = value.map(rule => ({ ...rule }));
    lastEmitted = JSON.stringify(payload);
    emit("change", payload);
  },
  { deep: true }
);

function emptyRule(type = "", match = ""): FieldRuleRow {
  return { table: "", field: "", match, type, value: "" };
}

function handleAdd() {
  draft.value = emptyRule();
  editingIndex.value = rules.value.length;
}

function handleEdit(index: number) {
  draft.value = { ...rules.value[index] };
  editingIndex.value = index;
}

function handleCopy(index: number) {
  rules.value.splice(index + 1, 0, { ...rules.value[index] });
}

function handleRemove(index: number) {
  rules.value.splice(index, 1);
  editingIndex.value = -1;
}

function handleCancelEdit() {
  editingIndex.value = -1;
}

function handleSubmitEdit() {
  if (editingIndex.value < rules.value.length) {
    rules.value.splice(editingIndex.value, 1, { ...draft.value });
  } else {
    rules.value.push({ ...draft.value });
  }
  editingIndex.value = -1;
}

/** 常用模板：只预置类型与匹配符；「全部数据」直接落成完整规则 */
function applyPreset(preset: RulePreset) {
  if (preset.wildcard) {
    const exists = rules.value.some(rule => rule.type === preset.type);
    if (!exists) {
      rules.value.push({
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
  editingIndex.value = rules.value.length;
}
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
        v-if="editingIndex === -1"
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

    <div v-if="rules.length || editingIndex >= 0" class="rule-list">
      <div
        v-for="(rule, index) in rules"
        :key="`${index}-${rule.table}-${rule.field}`"
        class="rule-row"
        data-testid="rule-row"
        :class="{ 'is-editing': editingIndex === index }"
      >
        <RuleEditForm
          v-if="editingIndex === index"
          :key="`edit-${index}`"
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
              @click="handleEdit(index)"
            />
            <el-button
              v-tippy="t('systemPermission.copyRule')"
              :aria-label="t('systemPermission.copyRule')"
              :icon="useRenderIcon(CopyDocument)"
              link
              size="small"
              type="primary"
              @click="handleCopy(index)"
            />
            <el-popconfirm
              :title="t('buttons.confirmDelete')"
              @confirm="handleRemove(index)"
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

      <div v-if="editingIndex === rules.length" class="rule-row is-editing">
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

    <el-empty
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
      :rules="rules"
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
  border-radius: 10px;
  transition: border-color 0.2s;
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
