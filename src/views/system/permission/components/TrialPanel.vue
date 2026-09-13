<script lang="ts" setup>
import { computed, isRef, ref } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { userApi } from "@/api/system/user";
import { hasAuth } from "@/router/utils";
import SearchUser from "@/views/system/components/SearchUser.vue";
import TrialResultPanel from "@/views/system/components/TrialResultPanel.vue";
import type {
  FieldTrialResult,
  TrialResult
} from "@/api/types/permission-preview";
import type { FieldLookupNode, FieldRuleRow } from "./utils/types";

defineOptions({ name: "PermissionTrialPanel" });

/**
 * 即时试算（配置页，草稿不落库）：
 * - 数据权限：把当前表单里**尚未保存**的规则 + 且/或模式 + 绑定菜单作为草稿，
 *   预演「该用户按这组规则能查到多少行」——与保存走同一套写入校验，不能绕过校验；
 * - 字段权限：预演「该用户在某菜单下实际能看到哪些字段」（未配置=裁空），
 *   可叠加一份未保存的字段白名单草稿看新增可见字段。
 */
const props = withDefaults(
  defineProps<{
    /** 当前表单里的规则（草稿） */
    rules?: FieldRuleRow[];
    /** 数据权限注册表树（取第二层作为试算模型候选） */
    ruleList?: FieldLookupNode[];
    /** 字段权限注册表（ROLE）树：模型 → 字段，字段试算草稿候选 */
    fieldRuleList?: FieldLookupNode[];
    /** 菜单上下文候选（绑定菜单的授权只在该上下文生效） */
    menus?: Array<{ value: string; label: string }>;
    /** 当前表单值（读 mode_type / menu 自动带入草稿，保证试算与保存同语义） */
    formValue?: unknown;
  }>(),
  {
    rules: () => [],
    ruleList: () => [],
    fieldRuleList: () => [],
    menus: () => []
  }
);

const { t } = useI18n();

/** 默认展开：试算入口折叠时极易被忽略 */
const activeNames = ref<string[]>(["trial"]);

/** 试算有独立权限码：缺失时只提示，不发必然 403 的请求 */
const canTrial = computed(() => hasAuth("previewTrial:SystemUser"));

const scope = ref<"data" | "field">("data");
const targetUser = ref<object | object[] | string>();

/* ---------- 表单上下文（草稿与保存保持同语义） ---------- */

const formValue = computed<Record<string, unknown>>(() => {
  const raw = props.formValue;
  if (!raw) return {};
  const value = isRef(raw) ? raw.value : raw;
  return (value ?? {}) as Record<string, unknown>;
});

/** 表单里的且/或模式（数字/字符串/labeled 对象归一；单条规则时服务端统一按或模式保存） */
const formMode = computed<number | null>(() => {
  const raw = formValue.value.mode_type;
  const value =
    raw && typeof raw === "object" ? (raw as { value?: unknown }).value : raw;
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
});

/** 表单绑定的菜单 pk 列表（多选；草稿只在这些菜单上下文生效） */
const boundMenuPks = computed<string[]>(() =>
  (Array.isArray(formValue.value.menu)
    ? formValue.value.menu
    : formValue.value.menu === null || formValue.value.menu === undefined
      ? []
      : [formValue.value.menu]
  )
    .map(item =>
      item && typeof item === "object" ? (item as { pk?: unknown }).pk : item
    )
    .filter(item => item !== null && item !== undefined && item !== "")
    .map(String)
);

/* ---------- 数据权限试算 ---------- */

const targetPk = computed(() => {
  const raw = targetUser.value as unknown;
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (first === null || first === undefined || first === "") return "";
  if (typeof first === "string" || typeof first === "number")
    return String(first);
  const pk = (first as { pk?: string | number }).pk;
  return pk === undefined || pk === null ? "" : String(pk);
});

const model = ref("");
const menuContext = ref("");
const loading = ref(false);
const result = ref<TrialResult | null>(null);

/** 试算模式：默认跟随表单，可手动覆盖 */
const modeOverride = ref<number | null>(null);
const effectiveMode = computed(() => modeOverride.value ?? formMode.value ?? 0);
const modeOverridden = computed(
  () => modeOverride.value !== null && modeOverride.value !== formMode.value
);

/** 模型候选 = 注册表树第二层（app → model → field） */
const modelOptions = computed(() => {
  const options: Array<{ value: string; label: string }> = [];
  props.ruleList.forEach(app => {
    (app.children ?? []).forEach(modelNode => {
      if (!modelNode.name || modelNode.name === "*") return;
      options.push({
        value: modelNode.name,
        label: `${modelNode.label ?? modelNode.name} (${modelNode.name})`
      });
    });
  });
  return options;
});

const canRunData = computed(
  () =>
    Boolean(targetPk.value && model.value && props.rules.length) &&
    !loading.value
);

/** 结果与当前草稿是否一致（规则/模式/绑定菜单变化后提示重新试算） */
const lastRunKey = ref("");
const draftKey = computed(() =>
  JSON.stringify({
    rules: props.rules,
    mode: effectiveMode.value,
    menu: boundMenuPks.value
  })
);
const dataStale = computed(
  () => Boolean(result.value) && lastRunKey.value !== draftKey.value
);

function handleModeChange(value: number) {
  // 与表单一致时回到「跟随」状态，避免留下无意义的覆盖标记
  modeOverride.value = value === formMode.value ? null : value;
}

async function runDataTrial() {
  if (!canRunData.value) return;
  loading.value = true;
  try {
    const res = await userApi.previewTrial(targetPk.value, {
      model: model.value,
      menu: menuContext.value ? menuContext.value : null,
      draft: {
        rules: props.rules as unknown as Array<Record<string, unknown>>,
        mode_type: effectiveMode.value,
        // 表单绑定的菜单一并带入：草稿只在对应上下文生效（与保存后一致）
        menu: boundMenuPks.value.length ? boundMenuPks.value : null
      }
    });
    result.value = res.data;
    lastRunKey.value = draftKey.value;
  } catch {
    result.value = null;
    message(t("permissionPreview.trialFailed"), { type: "error" });
  } finally {
    loading.value = false;
  }
}

/* ---------- 字段权限试算 ---------- */

const fieldResult = ref<FieldTrialResult | null>(null);

/** 字段注册表 → 模型候选（兼容 app→model→field 与 model→field 两种层级） */
const fieldModelOptions = computed(() => {
  const options: Array<{
    value: string;
    label: string;
    fields: Array<{ value: string; label: string }>;
  }> = [];
  const walk = (nodes: FieldLookupNode[]) => {
    nodes.forEach(node => {
      if (!node.name) return;
      const children = node.children ?? [];
      if (children.some(child => (child.children ?? []).length > 0)) {
        walk(children);
        return;
      }
      if (!children.length) return;
      options.push({
        value: node.name,
        label: node.label ?? node.name,
        fields: children
          .filter(child => Boolean(child.name))
          .map(child => ({
            value: child.name as string,
            label: child.label ?? (child.name as string)
          }))
      });
    });
  };
  walk(props.fieldRuleList);
  return options;
});

const draftFieldModel = ref("");
const draftFieldNames = ref<string[]>([]);
const draftFields = ref<Record<string, string[]>>({});

const draftFieldNameOptions = computed(
  () =>
    fieldModelOptions.value.find(item => item.value === draftFieldModel.value)
      ?.fields ?? []
);

const draftEntries = computed(() =>
  Object.keys(draftFields.value).map(modelLabel => {
    const option = fieldModelOptions.value.find(
      item => item.value === modelLabel
    );
    const labels = (draftFields.value[modelLabel] ?? []).map(
      name => option?.fields.find(field => field.value === name)?.label ?? name
    );
    return {
      model: modelLabel,
      label: option?.label ?? modelLabel,
      text: labels.join("、")
    };
  })
);

const hasDraftFields = computed(
  () => Object.keys(draftFields.value).length > 0
);
const canRunField = computed(
  () => Boolean(targetPk.value && menuContext.value) && !loading.value
);

function addDraftFields() {
  const modelLabel = draftFieldModel.value;
  if (!modelLabel || !draftFieldNames.value.length) return;
  const current = new Set(draftFields.value[modelLabel] ?? []);
  draftFieldNames.value.forEach(name => current.add(name));
  draftFields.value = {
    ...draftFields.value,
    [modelLabel]: [...current]
  };
  draftFieldNames.value = [];
}

function removeDraftEntry(modelLabel: string) {
  const next = { ...draftFields.value };
  delete next[modelLabel];
  draftFields.value = next;
}

async function runFieldTrial() {
  if (!canRunField.value) return;
  loading.value = true;
  try {
    const res = await userApi.previewFieldTrial(targetPk.value, {
      menu: menuContext.value,
      draft: hasDraftFields.value ? { fields: draftFields.value } : null
    });
    fieldResult.value = res.data;
  } catch {
    fieldResult.value = null;
    message(t("permissionPreview.trialFailed"), { type: "error" });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <el-collapse v-model="activeNames" class="mt-2">
    <el-collapse-item :title="t('permissionPreview.trialDraft')" name="trial">
      <el-alert
        v-if="!canTrial"
        :closable="false"
        :title="t('permissionPreview.trialNoAuth')"
        show-icon
        type="info"
      />
      <template v-else>
        <el-alert
          :closable="false"
          :title="t('permissionPreview.trialHint')"
          class="mb-2"
          show-icon
          type="info"
        />
        <el-radio-group v-model="scope" size="small" class="mb-2">
          <el-radio-button value="data">
            {{ t("permissionPreview.trialDataScope") }}
          </el-radio-button>
          <el-radio-button value="field">
            {{ t("permissionPreview.trialFieldScope") }}
          </el-radio-button>
        </el-radio-group>

        <!-- 数据权限：用户 + 模型 + 菜单上下文 + 且/或模式 -->
        <div v-if="scope === 'data'" class="flex flex-wrap items-center gap-2">
          <SearchUser v-model="targetUser" :multiple="false" class="w-60!" />
          <el-select
            v-model="model"
            :placeholder="t('permissionPreview.model')"
            class="w-60!"
            filterable
          >
            <el-option
              v-for="option in modelOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-select
            v-model="menuContext"
            :placeholder="t('permissionPreview.menuContext')"
            class="w-50!"
            clearable
            filterable
          >
            <el-option
              :label="t('permissionPreview.generalGrant')"
              :value="''"
            />
            <el-option
              v-for="menu in menus"
              :key="menu.value"
              :label="menu.label"
              :value="menu.value"
            />
          </el-select>
          <el-select
            :model-value="effectiveMode"
            class="w-32!"
            @update:model-value="handleModeChange"
          >
            <el-option :label="t('permissionPreview.modeOr')" :value="0" />
            <el-option :label="t('permissionPreview.modeAnd')" :value="1" />
          </el-select>
          <el-tooltip
            v-if="modeOverridden"
            :content="
              t('permissionPreview.modeOverrideHint', {
                mode:
                  formMode === 1
                    ? t('permissionPreview.modeAnd')
                    : t('permissionPreview.modeOr')
              })
            "
          >
            <el-tag size="small" type="warning">
              {{ t("permissionPreview.modeOverride") }}
            </el-tag>
          </el-tooltip>
          <el-button
            :disabled="!canRunData"
            :loading="loading"
            type="primary"
            @click="runDataTrial"
          >
            {{ t("permissionPreview.run") }}
          </el-button>
        </div>
        <el-text v-else class="mb-1" size="small" type="info">
          {{ t("permissionPreview.fieldDraftTip") }}
        </el-text>

        <el-text
          v-if="scope === 'data' && !rules.length"
          class="mt-2"
          type="info"
        >
          {{ t("permissionPreview.draftEmpty") }}
        </el-text>
        <el-text
          v-if="scope === 'data' && boundMenuPks.length"
          class="mt-2"
          size="small"
          type="info"
        >
          {{
            t("permissionPreview.boundMenuHint", {
              count: boundMenuPks.length
            })
          }}
        </el-text>

        <!-- 数据权限结果 -->
        <TrialResultPanel
          v-if="scope === 'data' && result"
          :result="result"
          show-draft
          :stale="dataStale"
        />

        <!-- 字段权限：用户 + 菜单（必填）+ 可选草稿白名单 -->
        <template v-if="scope === 'field'">
          <div class="flex flex-wrap items-center gap-2">
            <SearchUser v-model="targetUser" :multiple="false" class="w-60!" />
            <el-select
              v-model="menuContext"
              :placeholder="t('permissionPreview.menuContext')"
              class="w-50!"
              clearable
              filterable
            >
              <el-option
                v-for="menu in menus"
                :key="menu.value"
                :label="menu.label"
                :value="menu.value"
              />
            </el-select>
            <el-button
              :disabled="!canRunField"
              :loading="loading"
              type="primary"
              @click="runFieldTrial"
            >
              {{ t("permissionPreview.run") }}
            </el-button>
          </div>
          <el-text v-if="!menuContext" class="mt-2" type="info">
            {{ t("permissionPreview.fieldMenuRequired") }}
          </el-text>

          <div class="mt-2 flex flex-wrap items-center gap-2">
            <el-select
              v-model="draftFieldModel"
              :placeholder="t('permissionPreview.draftModel')"
              class="w-50!"
              clearable
              filterable
            >
              <el-option
                v-for="option in fieldModelOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
            <el-select
              v-model="draftFieldNames"
              :disabled="!draftFieldModel"
              :placeholder="t('permissionPreview.draftFields')"
              class="w-60!"
              collapse-tags
              filterable
              multiple
            >
              <el-option
                v-for="option in draftFieldNameOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
            <el-button
              :disabled="!draftFieldModel || !draftFieldNames.length"
              @click="addDraftFields"
            >
              {{ t("buttons.add") }}
            </el-button>
          </div>
          <div v-if="draftEntries.length" class="mt-1">
            <el-tag
              v-for="entry in draftEntries"
              :key="entry.model"
              class="mr-1"
              closable
              size="small"
              type="warning"
              @close="removeDraftEntry(entry.model)"
            >
              {{ entry.label }}：{{ entry.text }}
            </el-tag>
          </div>

          <!-- 字段权限结果 -->
          <template v-if="fieldResult">
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <span class="text-sm text-gray-500">
                {{ t("permissionPreview.fieldResultTitle") }}
              </span>
              <el-tag v-if="!fieldResult.enabled" size="small" type="warning">
                {{ t("permissionPreview.fieldDisabled") }}
              </el-tag>
              <el-tag
                v-if="fieldResult.draft_applied"
                size="small"
                type="warning"
              >
                {{ t("permissionPreview.draftApplied") }}
              </el-tag>
            </div>
            <el-alert
              v-if="fieldResult.note"
              :title="fieldResult.note"
              class="mt-2"
              :closable="false"
              show-icon
              type="warning"
            />
            <div
              v-for="item in fieldResult.models"
              :key="item.model"
              class="mt-2 rounded border border-gray-200 p-2 dark:border-gray-700"
            >
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium">{{ item.model_label }}</span>
                <el-tag size="small" type="info">{{ item.model }}</el-tag>
                <el-tag
                  size="small"
                  :type="item.configured ? 'success' : 'danger'"
                >
                  {{
                    item.configured
                      ? t("permissionPreview.fieldVisible", {
                          visible: item.fields.length,
                          total: item.total_fields
                        })
                      : t("permissionPreview.fieldUnconfigured")
                  }}
                </el-tag>
              </div>
              <div class="mt-1">
                <el-tag
                  v-for="(label, index) in item.field_labels"
                  :key="item.fields[index]"
                  class="mr-1 mb-1"
                  size="small"
                  :type="
                    item.draft_fields.includes(item.fields[index])
                      ? 'warning'
                      : undefined
                  "
                >
                  {{ label }}
                </el-tag>
                <el-text v-if="!item.fields.length" size="small" type="info">
                  {{ t("permissionPreview.fieldNone") }}
                </el-text>
              </div>
            </div>
          </template>
        </template>
      </template>
    </el-collapse-item>
  </el-collapse>
</template>
