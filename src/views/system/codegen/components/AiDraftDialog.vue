<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { MagicStick } from "@element-plus/icons-vue";
import DataTable from "@/components/DataTable";
import { message } from "@/utils/message";
import { isSuccess } from "@/api/types";
import {
  systemCodeGenApi,
  type CodegenAiDraftResult,
  type CodegenFieldOverride
} from "@/api/system/codegen";

/**
 * AI 字段草案（提案 P4 二阶段）：自然语言 → 字段覆盖草案的两段式人审弹窗——
 * 先描述生成，再逐项勾选采纳；采纳结果合并进字段配置表（state.fields），
 * 走既有预览/下载管线。AI 产物不直接生成代码。
 */
defineOptions({ name: "CodegenAiDraftDialog" });

const props = defineProps<{
  /** 目标模型 label（demo.Book 形态）；空 = 未选模型，入口按钮已禁用 */
  model: string;
}>();

const emit = defineEmits<{
  /** 勾选采纳的草案项（父级合并进字段配置） */
  apply: [fields: CodegenFieldOverride[]];
}>();

const { t } = useI18n();

const visible = ref(false);
const description = ref("");
const loading = ref(false);
const result = ref<CodegenAiDraftResult | null>(null);
/** 逐项采纳勾选（人审步骤：默认全选，用户可取消个别项） */
const selected = ref<Record<string, boolean>>({});

const reset = () => {
  description.value = "";
  result.value = null;
  selected.value = {};
};

const open = () => {
  reset();
  visible.value = true;
};

const runDraft = async () => {
  if (!description.value.trim() || !props.model) return;
  loading.value = true;
  try {
    // 异常归一为信封：开关关闭 / AI 未配置 / 网关失败 / 无权限都必须给出可读提示，
    // 不能只让按钮从 loading 恢复（200 + 业务码与网络异常同一出口）
    const res = await systemCodeGenApi
      .aiDraft({ model: props.model, description: description.value.trim() })
      .catch(
        (error: { detail?: string; message?: string } | null | undefined) => ({
          code: -1,
          data: null,
          detail: error?.detail ?? error?.message
        })
      );
    if (!isSuccess(res) || !res.data) {
      message(String(res?.detail || t("results.failed")), { type: "error" });
      return;
    }
    result.value = res.data;
    selected.value = Object.fromEntries(
      (res.data.fields ?? []).map(field => [field.name, true])
    );
    if (!res.data.fields?.length) {
      message(t("codegen.aiDraftNoFields"), { type: "warning" });
    }
  } finally {
    loading.value = false;
  }
};

const adoptedFields = computed(() =>
  (result.value?.fields ?? []).filter(field => selected.value[field.name])
);

const applyDraft = () => {
  if (!adoptedFields.value.length) return;
  emit("apply", adoptedFields.value);
  message(t("codegen.aiDraftApplied", { count: adoptedFields.value.length }), {
    type: "success"
  });
  visible.value = false;
};

const flagText = (field: CodegenFieldOverride) => {
  const flags: string[] = [];
  if (field.include === false) flags.push(t("codegen.aiDraftFlagExcluded"));
  if (field.required !== undefined)
    flags.push(
      field.required
        ? t("codegen.aiDraftFlagRequired")
        : t("codegen.aiDraftFlagOptional")
    );
  if (field.read_only) flags.push(t("codegen.aiDraftFlagReadonly"));
  if (field.in_table) flags.push(t("codegen.aiDraftFlagInTable"));
  if (field.in_search) flags.push(t("codegen.aiDraftFlagInSearch"));
  if (field.input_type) flags.push(`input_type: ${field.input_type}`);
  if (field.dict_code) flags.push(`dict: ${field.dict_code}`);
  if (field.field_class) flags.push(field.field_class);
  return flags.join(" · ");
};

defineExpose({ open });
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="t('codegen.aiDraftTitle')"
    width="640px"
    top="8vh"
  >
    <el-form label-position="top" @submit.prevent>
      <el-form-item :label="t('codegen.aiDraftLabel')">
        <el-input
          v-model="description"
          type="textarea"
          :rows="3"
          :maxlength="2000"
          show-word-limit
          :placeholder="t('codegen.aiDraftPlaceholder')"
          data-testid="ai-draft-description"
        />
      </el-form-item>
      <el-button
        type="primary"
        :icon="MagicStick"
        :loading="loading"
        :disabled="!description.trim()"
        data-testid="ai-draft-run"
        @click="runDraft"
      >
        {{ t("codegen.aiDraftRun") }}
      </el-button>
    </el-form>
    <template v-if="result">
      <el-alert
        v-if="result.summary"
        :title="result.summary"
        type="info"
        :closable="false"
        class="mt-3!"
        data-testid="ai-draft-summary"
      />
      <el-alert
        v-if="result.warnings.length"
        type="warning"
        :closable="false"
        class="mt-2!"
      >
        <template #title>
          {{ t("codegen.aiDraftWarnings", { count: result.warnings.length }) }}
        </template>
        <div
          v-for="(warning, index) in result.warnings"
          :key="index"
          class="text-xs leading-5 break-all"
        >
          {{ warning }}
        </div>
      </el-alert>
      <DataTable
        v-if="result.fields.length"
        :data="result.fields"
        :label="t('codegen.aiDraftTitle')"
        size="small"
        class="mt-3"
        max-height="320"
        data-testid="ai-draft-table"
      >
        <el-table-column width="42" align="center">
          <template #default="{ row }">
            <el-checkbox v-model="selected[row.name]" />
          </template>
        </el-table-column>
        <el-table-column
          prop="name"
          :label="t('codegen.aiDraftColField')"
          width="140"
        />
        <el-table-column
          prop="label"
          :label="t('codegen.aiDraftColLabel')"
          width="140"
        >
          <template #default="{ row }">
            {{ row.label ?? "-" }}
          </template>
        </el-table-column>
        <el-table-column :label="t('codegen.aiDraftColOverrides')">
          <template #default="{ row }">
            <span class="text-xs">{{
              flagText(row as CodegenFieldOverride) || "-"
            }}</span>
          </template>
        </el-table-column>
      </DataTable>
    </template>
    <template #footer>
      <el-button @click="visible = false">
        {{ t("buttons.close") }}
      </el-button>
      <el-button
        type="primary"
        :disabled="!adoptedFields.length"
        data-testid="ai-draft-apply"
        @click="applyDraft"
      >
        {{ t("codegen.aiDraftApply", { count: adoptedFields.length }) }}
      </el-button>
    </template>
  </el-dialog>
</template>
