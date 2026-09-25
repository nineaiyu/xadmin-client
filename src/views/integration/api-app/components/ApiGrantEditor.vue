<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessage } from "element-plus";
import {
  loadGrantCatalog,
  type ApiApplicationGrant,
  type GrantModelOption,
  type RowFilterRule
} from "@/api/system/open";

/**
 * 应用资源授权编辑器：模型 × 动作 × 字段 × 行 四级收敛。
 *
 * - 空清单 = 兼容模式（沿用 owner 权限 + 接口范围）；
 * - 添加任意一条即白名单模式：模型/动作必须命中，字段与行级在覆盖规则上继续收敛；
 * - 目录（模型/动作/字段）由后端 `grant-options` 按当前用户可授权面下发，同页只拉一次。
 */
defineOptions({ name: "ApiApplicationGrantEditor" });

const grants = defineModel<ApiApplicationGrant[]>({ default: () => [] });
const { t } = useI18n();

const models = ref<GrantModelOption[]>([]);
const loading = ref(false);

const modelMap = computed(() => {
  const map = new Map<string, GrantModelOption>();
  models.value.forEach(item => map.set(item.value, item));
  return map;
});

const modelOptions = computed(() =>
  models.value.map(item => ({
    value: item.value,
    label: item.value === "*" ? t("apiApp.grant.allModels") : item.label
  }))
);

const matchOptions = computed(() => [
  { value: "exact", label: t("apiApp.grant.matchExact") },
  { value: "icontains", label: t("apiApp.grant.matchContains") },
  { value: "in", label: t("apiApp.grant.matchIn") },
  { value: "gt", label: t("apiApp.grant.matchGt") },
  { value: "gte", label: t("apiApp.grant.matchGte") },
  { value: "lt", label: t("apiApp.grant.matchLt") },
  { value: "lte", label: t("apiApp.grant.matchLte") }
]);

onMounted(async () => {
  loading.value = true;
  try {
    const res = await loadGrantCatalog();
    models.value = res.data?.models ?? [];
  } catch {
    ElMessage.error(t("apiApp.grant.catalogFailed"));
  } finally {
    loading.value = false;
  }
});

const actionsOf = (grant: ApiApplicationGrant) =>
  modelMap.value.get(grant.model)?.actions ?? [
    { value: "*", label: t("apiApp.grant.allActions") }
  ];

const fieldsOf = (grant: ApiApplicationGrant) =>
  modelMap.value.get(grant.model)?.fields ?? [];

const addGrant = () => {
  grants.value = [
    ...grants.value,
    {
      model: "*",
      actions: ["*"],
      fields: [],
      row_filter: [],
      is_active: true
    }
  ];
};

const removeGrant = (index: number) => {
  const next = [...grants.value];
  next.splice(index, 1);
  grants.value = next;
};

/** 模型变化：动作/字段按新模型目录收敛（通配模型下字段与行级无意义，直接清空） */
const onModelChange = (grant: ApiApplicationGrant) => {
  const option = modelMap.value.get(grant.model);
  if (grant.model === "*") {
    grant.actions = ["*"];
    grant.fields = [];
    grant.row_filter = [];
    return;
  }
  const allowedActions = new Set(
    (option?.actions ?? []).map(item => item.value)
  );
  grant.actions = grant.actions.filter(action => allowedActions.has(action));
  if (!grant.actions.length && option?.actions?.length) {
    grant.actions = [option.actions[0].value];
  }
  const allowedFields = new Set((option?.fields ?? []).map(item => item.value));
  grant.fields = grant.fields.filter(field => allowedFields.has(field));
  const allowedRowFields = allowedFields;
  grant.row_filter = (grant.row_filter ?? []).filter(rule =>
    allowedRowFields.has(String(rule.field ?? ""))
  );
};

const addRowRule = (grant: ApiApplicationGrant) => {
  grant.row_filter = [
    ...(grant.row_filter ?? []),
    { field: "", match: "exact", value: "", type: "value.text" }
  ];
};

const removeRowRule = (grant: ApiApplicationGrant, index: number) => {
  const next = [...(grant.row_filter ?? [])];
  next.splice(index, 1);
  grant.row_filter = next;
};

/** `in` 匹配的值以逗号分隔数组提交，其余原样字符串 */
const normalizeRuleValue = (rule: RowFilterRule) => {
  const raw = String(rule.value ?? "").trim();
  if (rule.match === "in") {
    return raw
      .split(/[,，]/)
      .map(item => item.trim())
      .filter(Boolean);
  }
  return raw;
};

const ruleValueText = (rule: RowFilterRule) =>
  Array.isArray(rule.value) ? rule.value.join(",") : String(rule.value ?? "");

const onRuleValueChange = (rule: RowFilterRule, text: string) => {
  rule.value = text;
};

/** 提交前把规则值归一（页面 getPayload 调用） */
const normalize = () =>
  grants.value.map(grant => ({
    ...grant,
    row_filter: (grant.row_filter ?? []).map(rule => ({
      ...rule,
      value: normalizeRuleValue(rule)
    }))
  }));

defineExpose({ normalize });
</script>

<template>
  <div v-loading="loading" class="grant-editor">
    <el-alert
      :title="t('apiApp.grant.hint')"
      type="info"
      :closable="false"
      show-icon
      class="mb-2"
    />
    <div
      v-for="(grant, index) in grants"
      :key="grant.pk ?? index"
      class="grant-item"
    >
      <div class="grant-row">
        <el-select
          v-model="grant.model"
          class="grant-model"
          filterable
          :placeholder="t('apiApp.grant.model')"
          @change="onModelChange(grant)"
        >
          <el-option
            v-for="option in modelOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <el-select
          v-model="grant.actions"
          class="grant-actions"
          multiple
          collapse-tags
          collapse-tags-tooltip
          :placeholder="t('apiApp.grant.actions')"
        >
          <el-option
            v-for="option in actionsOf(grant)"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <el-switch
          v-model="grant.is_active"
          :active-text="t('apiApp.grant.enabled')"
        />
        <el-button
          type="danger"
          link
          :aria-label="t('apiApp.grant.remove')"
          @click="removeGrant(index)"
        >
          {{ t("apiApp.grant.remove") }}
        </el-button>
      </div>
      <div v-if="grant.model !== '*'" class="grant-row">
        <el-select
          v-model="grant.fields"
          class="grant-fields"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          :placeholder="t('apiApp.grant.fieldsPlaceholder')"
        >
          <el-option
            v-for="option in fieldsOf(grant)"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </div>
      <div v-if="grant.model !== '*'" class="row-filter">
        <div class="row-filter-head">
          <span class="row-filter-title">{{
            t("apiApp.grant.rowFilter")
          }}</span>
          <el-button link type="primary" @click="addRowRule(grant)">
            {{ t("apiApp.grant.addRow") }}
          </el-button>
        </div>
        <div
          v-for="(rule, ruleIndex) in grant.row_filter"
          :key="ruleIndex"
          class="row-filter-line"
        >
          <el-select
            v-model="rule.field"
            class="rule-field"
            filterable
            :placeholder="t('apiApp.grant.rowField')"
          >
            <el-option
              v-for="option in fieldsOf(grant)"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-select
            v-model="rule.match"
            class="rule-match"
            :placeholder="t('apiApp.grant.rowMatch')"
          >
            <el-option
              v-for="option in matchOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-input
            :model-value="ruleValueText(rule)"
            class="rule-value"
            :placeholder="t('apiApp.grant.rowValue')"
            @update:model-value="
              (value: string) => onRuleValueChange(rule, value)
            "
          />
          <el-button
            type="danger"
            link
            :aria-label="t('apiApp.grant.removeRow')"
            @click="removeRowRule(grant, ruleIndex)"
          >
            {{ t("apiApp.grant.removeRow") }}
          </el-button>
        </div>
      </div>
    </div>
    <el-button type="primary" plain @click="addGrant">
      {{ t("apiApp.grant.add") }}
    </el-button>
  </div>
</template>

<style lang="scss" scoped>
.grant-editor {
  width: 100%;
}

.grant-item {
  padding: 10px 12px;
  margin-bottom: 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.grant-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}

.grant-model {
  width: 240px;
}

.grant-actions {
  width: 320px;
}

.grant-fields {
  width: 100%;
}

.row-filter {
  padding: 6px 8px;
  background: var(--el-fill-color-lighter);
  border-radius: var(--el-border-radius-base);
}

.row-filter-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.row-filter-title {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}

.row-filter-line {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 6px;
}

.rule-field {
  width: 200px;
}

.rule-match {
  width: 170px;
}

.rule-value {
  flex: 1;
}
</style>
