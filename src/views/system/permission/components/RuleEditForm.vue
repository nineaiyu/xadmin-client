<script lang="ts" setup>
import { computed, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { FieldKeyChoices } from "@/views/system/constants";
import {
  getDateTimePickerShortcuts,
  getPickerShortcuts
} from "@/components/RePlusPage";
import SearchPicker from "@/components/SearchPicker";
import RuleFieldPicker from "./RuleFieldPicker.vue";
import {
  groupRuleTypes,
  ruleDefaultMatch,
  ruleMatchFixed,
  ruleTypeOption,
  ruleValueInput,
  ruleValueRequired
} from "./utils/ruleMeta";
import {
  parseObjectValue,
  parseRangeValue,
  SECOND_UNIT_CHOICES,
  toSecondsEditor,
  type SecondsEditor
} from "./utils/ruleValue";
import {
  buildRulePayload,
  editorValueOf,
  validateRule
} from "./utils/ruleFormLogic";
import type {
  FieldLookupItem,
  FieldLookupNode,
  FieldRuleRow
} from "./utils/types";

defineOptions({ name: "PermissionRuleEditForm" });

interface Props {
  /** 编辑中的规则（作为初始值；改动在提交时通过 update:modelValue 回传） */
  modelValue: FieldRuleRow;
  /** 数据权限字段树（应用 → 模型 → 字段；含「全部表」通配节点） */
  fieldLookupsData?: FieldLookupNode[];
  /** 规则类型选项（后端 choices 下发，含值控件元数据） */
  valuesData?: FieldLookupItem[];
}

const props = withDefaults(defineProps<Props>(), {
  fieldLookupsData: () => [],
  valuesData: () => []
});

const emit = defineEmits<{
  "update:modelValue": [rule: FieldRuleRow];
  submit: [];
  cancel: [];
}>();

const { t } = useI18n();

/** 过滤对象的级联路径（应用 / 模型 / 字段）；表与字段由末端两段派生 */
const scopePath = ref<string[]>([]);
const type = ref("");
const match = ref("");
const exclude = ref(false);
const textValue = ref("");
const jsonValue = ref("");
const datetimeValue = ref("");
const rangeValue = ref<string[] | null>(null);
const secondsEditor = ref<SecondsEditor>(toSecondsEditor(""));
const objectValue = ref<object | object[] | string | undefined>([]);
const matchOptions = ref<FieldLookupItem[]>([]);
const errors = ref<Record<string, string>>({});

/** 表单值回填期间跳过「字段变化 → 清空取值」的联动（否则编辑回显的取值会被清掉） */
const initializing = ref(false);

const table = computed(() => {
  const list = scopePath.value;
  return list.length >= 2 ? list[list.length - 2] : "";
});
const field = computed(() => {
  const list = scopePath.value;
  return list.length >= 1 ? list[list.length - 1] : "";
});
const typeItem = computed(() => ruleTypeOption(props.valuesData, type.value));
const input = computed(() => ruleValueInput(type.value, typeItem.value));
const matchFixed = computed(() => ruleMatchFixed(type.value, typeItem.value));
const valueRequired = computed(() =>
  ruleValueRequired(type.value, typeItem.value)
);
const typeGroups = computed(() => groupRuleTypes(props.valuesData));
const typeHint = computed(() => typeItem.value?.hint ?? "");
const isAll = computed(() => type.value === FieldKeyChoices.ALL);
/** 关联对象取值需要通讯录搜索选择器；缺对应搜索权限时不给纯文本退化入口 */
const objectPickerMissing = computed(() => {
  if (input.value === "user") return !hasAuth("list:SearchUser");
  if (input.value === "dept") return !hasAuth("list:SearchDept");
  if (input.value === "role") return !hasAuth("list:SearchRole");
  if (input.value === "menu") return !hasAuth("list:SearchMenu");
  return false;
});
const effectiveMatch = computed(() =>
  matchFixed.value ? ruleDefaultMatch(type.value, typeItem.value) : match.value
);
const runtimeValueText = computed(() => t("systemPermission.valueByRuntime"));

/** table / field → 级联路径（具体表补上所属应用；找不到时退化为「表 / 字段」两段） */
function scopePathInApp(tableName?: string, fieldName?: string): string[] {
  const tableValue = tableName ?? "*";
  const fieldValue = fieldName ? fieldName : "*";
  if (!tableValue || tableValue === "*") return ["*", fieldValue];
  const app = props.fieldLookupsData.find(item =>
    (item.children ?? []).some(child => child.name === tableValue)
  );
  return app
    ? [String(app.name), tableValue, fieldValue]
    : [tableValue, fieldValue];
}

/**
 * 「全部数据」规则的级联路径：保留表、字段固定为通配。
 *
 * 全部数据只约束「表」维度（后端按 `table` 过滤规则、`type=value.all` 恒真），
 * 因此选了具体表时应表达「该表的全部数据」，不能改写成「全部表」——后者会把
 * 单表授权静默放大成所有表的授权。
 */
function allFieldsPathOf(tableName?: string): string[] {
  return scopePathInApp(tableName, "*");
}

function resetValueState() {
  textValue.value = "";
  jsonValue.value = "";
  datetimeValue.value = "";
  rangeValue.value = null;
  secondsEditor.value = toSecondsEditor("");
  objectValue.value = [];
}

function initFromRule(rule: FieldRuleRow) {
  initializing.value = true;
  type.value = rule.type ?? "";
  scopePath.value =
    rule.type === FieldKeyChoices.ALL
      ? allFieldsPathOf(rule.table)
      : scopePathInApp(rule.table, rule.field);
  match.value = rule.match ?? "";
  exclude.value = Boolean(rule.exclude);
  resetValueState();
  errors.value = {};
  const currentInput = ruleValueInput(
    rule.type,
    props.valuesData.find(item => item.value === rule.type)
  );
  if (currentInput === "text") textValue.value = String(rule.value ?? "");
  else if (currentInput === "json")
    jsonValue.value =
      typeof rule.value === "string"
        ? rule.value
        : JSON.stringify(rule.value ?? "", null, 2);
  else if (currentInput === "datetime")
    datetimeValue.value = String(rule.value ?? "");
  else if (currentInput === "datetimerange")
    rangeValue.value = parseRangeValue(rule.value);
  else if (
    currentInput === "user" ||
    currentInput === "dept" ||
    currentInput === "role" ||
    currentInput === "menu"
  ) {
    objectValue.value = parseObjectValue(rule.value);
  } else if (currentInput === "seconds") {
    secondsEditor.value = toSecondsEditor(rule.value);
  }
  // 回填完成后恢复联动（回填期间的字段变化不应清空取值）
  nextTick(() => (initializing.value = false));
}

watch(() => props.modelValue, initFromRule, { immediate: true });

// 过滤对象变化后旧的取值失去语义，一律清空重填；匹配符候选由字段选择器加载
watch(scopePath, path => {
  if (initializing.value) return;
  if (isAll.value) {
    // 全部数据只区分「哪张表」：用户改选到具体字段时归一为「表 + 全部字段」
    const normalized = allFieldsPathOf(path[path.length - 2]);
    if (normalized.join("\u0000") !== path.join("\u0000")) {
      scopePath.value = normalized;
    }
    return;
  }
  resetValueState();
});

function handleTypeChange(value: string) {
  const item = ruleTypeOption(props.valuesData, value);
  errors.value = {};
  resetValueState();
  if (value === FieldKeyChoices.ALL) {
    // 保留已选表（表达「该表全部数据」），未选表才落「全部表」，避免单表规则被静默放大
    scopePath.value = allFieldsPathOf(table.value);
    match.value = "all";
    return;
  }
  match.value = ruleDefaultMatch(value, item);
  if (field.value === "*") {
    // 通配字段只在「全部数据」下有意义；其余类型需重新选择过滤字段
    scopePath.value = [];
  }
}

function editorValue(): unknown {
  return editorValueOf({
    input: input.value,
    text: textValue.value,
    json: jsonValue.value,
    datetime: datetimeValue.value,
    range: rangeValue.value,
    seconds: secondsEditor.value,
    object: objectValue.value
  });
}

function validate(): Record<string, string> {
  return validateRule(
    {
      type: type.value,
      isAll: isAll.value,
      table: table.value,
      field: field.value,
      matchFixed: matchFixed.value,
      match: match.value,
      objectPickerMissing: objectPickerMissing.value,
      input: input.value,
      json: jsonValue.value,
      valueRequired: valueRequired.value,
      value: editorValue()
    },
    {
      typeRequired: t("systemPermission.editor.typeRequired"),
      scopeRequired: t("systemPermission.editor.scopeRequired"),
      matchRequired: t("systemPermission.editor.matchRequired"),
      pickerAuthMissing: t("systemPermission.editor.pickerAuthMissing"),
      jsonInvalid: t("systemPermission.editor.jsonInvalid"),
      valueRequired: t("systemPermission.editor.valueRequired")
    }
  );
}

function handleSubmit() {
  errors.value = validate();
  if (Object.keys(errors.value).length) return;
  emit(
    "update:modelValue",
    buildRulePayload({
      isAll: isAll.value,
      table: table.value,
      field: field.value,
      match: effectiveMatch.value,
      exclude: exclude.value,
      type: type.value,
      value: editorValue()
    })
  );
  emit("submit");
}

defineExpose({ validate });
</script>

<template>
  <div class="rule-edit-card">
    <div class="grid grid-cols-1 gap-x-4 md:grid-cols-2">
      <!-- 过滤对象：应用 / 模型 / 字段级联；字段选「全部字段」等价于该表全部数据 -->
      <RuleFieldPicker
        v-model:match="match"
        v-model:match-options="matchOptions"
        v-model:path="scopePath"
        :error="errors.scope"
        :field-lookups-data="fieldLookupsData"
        @wildcard="handleTypeChange(FieldKeyChoices.ALL)"
      />
      <div class="flex flex-col gap-1" data-testid="rule-type">
        <span class="rule-edit-label">{{
          t("systemPermission.editor.type")
        }}</span>
        <el-select
          v-model="type"
          class="w-full"
          filterable
          :placeholder="t('systemPermission.editor.typePlaceholder')"
          @change="handleTypeChange"
        >
          <el-option-group
            v-for="group in typeGroups"
            :key="group.key"
            :label="t(`systemPermission.editor.typeGroup.${group.key}`)"
          >
            <el-option
              v-for="item in group.items"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            >
              <span class="flex-bc gap-3">
                <span>{{ item.label }}</span>
                <span class="rule-edit-option-hint">{{ item.hint }}</span>
              </span>
            </el-option>
          </el-option-group>
        </el-select>
        <span v-if="errors.type" class="rule-edit-error">{{
          errors.type
        }}</span>
      </div>
      <div class="flex flex-col gap-1" data-testid="rule-match">
        <span class="rule-edit-label">{{
          t("systemPermission.editor.match")
        }}</span>
        <el-select
          v-if="!matchFixed"
          v-model="match"
          class="w-full"
          clearable
          filterable
          :reserve-keyword="false"
          :placeholder="t('systemPermission.editor.matchPlaceholder')"
        >
          <el-option
            v-for="item in matchOptions"
            :key="item.value"
            :label="`${item.value} · ${item.label}`"
            :value="item.value"
          />
        </el-select>
        <el-input v-else disabled :model-value="effectiveMatch" />
        <span v-if="matchFixed" class="rule-edit-meta">{{
          t("systemPermission.editor.matchFixedTip")
        }}</span>
        <span v-if="errors.match" class="rule-edit-error">{{
          errors.match
        }}</span>
      </div>
    </div>

    <div class="mt-3 flex flex-col gap-1" data-testid="rule-value">
      <div class="flex-bc">
        <span class="rule-edit-label">{{
          t("systemPermission.editor.value")
        }}</span>
        <el-radio-group v-if="!isAll" v-model="exclude" size="small">
          <el-radio-button :value="false">{{
            t("systemPermission.excludeInclude")
          }}</el-radio-button>
          <el-radio-button :value="true">{{
            t("systemPermission.excludeExclude")
          }}</el-radio-button>
        </el-radio-group>
      </div>

      <el-text v-if="input === 'none'" type="info" size="small">
        {{ isAll ? t("systemPermission.editor.summaryAll") : runtimeValueText }}
      </el-text>
      <el-date-picker
        v-else-if="input === 'datetime'"
        v-model="datetimeValue"
        class="w-full"
        :placeholder="t('systemPermission.addValue')"
        :shortcuts="getDateTimePickerShortcuts()"
        type="datetime"
        value-format="YYYY-MM-DD HH:mm:ss"
      />
      <el-date-picker
        v-else-if="input === 'datetimerange'"
        v-model="rangeValue"
        class="w-full"
        :shortcuts="getPickerShortcuts()"
        type="datetimerange"
        value-format="YYYY-MM-DD HH:mm:ss"
      />
      <div v-else-if="input === 'seconds'" class="flex items-center gap-2">
        <el-select
          v-model="secondsEditor.future"
          class="w-28"
          :teleported="true"
        >
          <el-option
            :label="t('systemPermission.editor.secondsPast')"
            :value="false"
          />
          <el-option
            :label="t('systemPermission.editor.secondsFuture')"
            :value="true"
          />
        </el-select>
        <el-input-number
          v-model="secondsEditor.amount"
          class="w-32"
          :min="1"
          :max="9999"
          controls-position="right"
        />
        <el-select v-model="secondsEditor.unit" class="w-28">
          <el-option
            v-for="unit in SECOND_UNIT_CHOICES"
            :key="unit"
            :label="t(`systemPermission.editor.secondsUnit.${unit}`)"
            :value="unit"
          />
        </el-select>
      </div>
      <el-input
        v-else-if="input === 'json'"
        v-model="jsonValue"
        :autosize="{ minRows: 2, maxRows: 6 }"
        :placeholder="t('systemPermission.editor.jsonPlaceholder')"
        type="textarea"
      />
      <SearchPicker
        v-else-if="input === 'user' && hasAuth('list:SearchUser')"
        v-model="objectValue"
        entity="user"
      />
      <SearchPicker
        v-else-if="input === 'dept' && hasAuth('list:SearchDept')"
        v-model="objectValue"
        entity="dept"
      />
      <SearchPicker
        v-else-if="input === 'role' && hasAuth('list:SearchRole')"
        v-model="objectValue"
        entity="role"
      />
      <SearchPicker
        v-else-if="input === 'menu' && hasAuth('list:SearchMenu')"
        v-model="objectValue"
        entity="menu"
      />
      <!-- 关联对象类型但缺搜索权限：禁用态提示，避免退化为纯文本取值（裸字符串进规则） -->
      <el-input
        v-else-if="objectPickerMissing"
        disabled
        :placeholder="t('systemPermission.editor.pickerAuthMissing')"
      />
      <el-input
        v-else
        v-model="textValue"
        clearable
        :placeholder="t('systemPermission.addValue')"
      />
      <span v-if="errors.value" class="rule-edit-error">{{
        errors.value
      }}</span>
    </div>

    <el-alert
      v-if="typeHint"
      class="mt-3"
      :closable="false"
      :title="typeHint"
      show-icon
      type="info"
    />

    <div class="mt-4 flex justify-end gap-2">
      <el-button data-testid="rule-cancel" size="small" @click="emit('cancel')">
        {{ t("buttons.cancel") }}
      </el-button>
      <el-button
        data-testid="rule-save"
        size="small"
        type="primary"
        @click="handleSubmit"
      >
        {{ t("buttons.save") }}
      </el-button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.rule-edit-card {
  padding: 16px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-lg);
}

.rule-edit-label {
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-regular);
}

.rule-edit-error {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-color-danger);
}

.rule-edit-meta,
.rule-edit-option-hint {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}
</style>
