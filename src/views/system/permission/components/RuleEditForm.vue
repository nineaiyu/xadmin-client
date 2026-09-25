<script lang="ts" setup>
import { computed, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth } from "@/router/utils";
import { FieldKeyChoices } from "@/views/system/constants";
import {
  getDateTimePickerShortcuts,
  getPickerShortcuts
} from "@/components/RePlusPage";
import SearchUser from "@/views/system/components/SearchUser.vue";
import SearchDept from "@/views/system/components/SearchDept.vue";
import SearchRole from "@/views/system/components/SearchRole.vue";
import SearchMenu from "@/views/system/components/SearchMenu.vue";
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
  fromSecondsEditor,
  isEmptyValue,
  parseObjectValue,
  parseRangeValue,
  SECOND_UNIT_CHOICES,
  serializeObjectValue,
  toSecondsEditor,
  type SecondsEditor
} from "./utils/ruleValue";
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
const effectiveMatch = computed(() =>
  matchFixed.value ? ruleDefaultMatch(type.value, typeItem.value) : match.value
);
const runtimeValueText = computed(() => t("systemPermission.valueByRuntime"));

/** 由规则的 table / field 反推级联路径（编辑回显；找不到所属应用时退化为「表 / 字段」两段） */
function scopePathOf(tableName?: string, fieldName?: string): string[] {
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
  scopePath.value = scopePathOf(rule.table, rule.field);
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
  nextTick(() => {
    initializing.value = false;
  });
}

watch(() => props.modelValue, initFromRule, { immediate: true });

// 过滤对象变化后旧的取值失去语义，一律清空重填；匹配符候选由字段选择器加载
watch(scopePath, () => {
  if (initializing.value) return;
  resetValueState();
});

function handleTypeChange(value: string) {
  const item = ruleTypeOption(props.valuesData, value);
  errors.value = {};
  resetValueState();
  if (value === FieldKeyChoices.ALL) {
    // 「全部数据」不需要过滤对象，路径锁到「全部表 + 全部字段」并置为只读
    scopePath.value = ["*", "*"];
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
  switch (input.value) {
    case "none":
      return "*";
    case "json":
      return jsonValue.value;
    case "datetime":
      return datetimeValue.value;
    case "datetimerange":
      return rangeValue.value ?? [];
    case "seconds":
      return fromSecondsEditor(secondsEditor.value);
    case "user":
    case "dept":
    case "role":
    case "menu":
      return serializeObjectValue(objectValue.value);
    default:
      return textValue.value;
  }
}

function validate(): Record<string, string> {
  const next: Record<string, string> = {};
  if (!type.value) next.type = t("systemPermission.editor.typeRequired");
  if (!isAll.value) {
    if (!table.value || !field.value) {
      next.scope = t("systemPermission.editor.scopeRequired");
    }
    if (!matchFixed.value && !match.value)
      next.match = t("systemPermission.editor.matchRequired");
    if (input.value === "json" && jsonValue.value) {
      try {
        JSON.parse(jsonValue.value);
      } catch {
        next.value = t("systemPermission.editor.jsonInvalid");
      }
    }
    if (
      valueRequired.value &&
      isEmptyValue(input.value, editorValue()) &&
      !next.value
    ) {
      next.value = t("systemPermission.editor.valueRequired");
    }
  }
  return next;
}

function handleSubmit() {
  errors.value = validate();
  if (Object.keys(errors.value).length) return;
  const payload: FieldRuleRow = isAll.value
    ? {
        table: "*",
        field: "*",
        match: "all",
        exclude: false,
        type: FieldKeyChoices.ALL,
        value: "*"
      }
    : {
        table: table.value,
        field: field.value,
        match: effectiveMatch.value || "exact",
        exclude: exclude.value,
        type: type.value,
        value: editorValue()
      };
  emit("update:modelValue", payload);
  emit("submit");
}

defineExpose({ validate });
</script>

<template>
  <div class="rule-edit-card">
    <div class="grid grid-cols-1 gap-x-4 md:grid-cols-2">
      <!-- 过滤对象：应用 / 模型 / 字段级联；选「全部表 + 全部字段」等价于全部数据 -->
      <RuleFieldPicker
        v-model:match="match"
        v-model:match-options="matchOptions"
        v-model:path="scopePath"
        :disabled="isAll"
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
      <SearchUser
        v-else-if="input === 'user' && hasAuth('list:SearchUser')"
        v-model="objectValue"
      />
      <SearchDept
        v-else-if="input === 'dept' && hasAuth('list:SearchDept')"
        v-model="objectValue"
      />
      <SearchRole
        v-else-if="input === 'role' && hasAuth('list:SearchRole')"
        v-model="objectValue"
      />
      <SearchMenu
        v-else-if="input === 'menu' && hasAuth('list:SearchMenu')"
        v-model="objectValue"
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
  border-radius: 10px;
}

.rule-edit-label {
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-regular);
}

.rule-edit-error {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-color-danger);
}

.rule-edit-meta {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}

.rule-edit-option-hint {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}
</style>
