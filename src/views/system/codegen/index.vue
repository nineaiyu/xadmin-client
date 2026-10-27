<script lang="ts" setup>
import ReEmpty from "@/components/ReEmpty";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch
} from "vue";
import { useI18n } from "vue-i18n";
import { MagicStick, Download } from "@element-plus/icons-vue";
import { normalizeError } from "@/utils/apiError";
import { hasAuth } from "@/router/utils";
import { useDesignerGuard } from "@/hooks/useDesignerGuard";
import { isSuccess } from "@/api/types";
import { systemCodeGenApi } from "@/api/system/codegen";
import RePage from "@/components/RePage";
import type {
  CodegenArtifact,
  CodegenFieldOverride,
  CodegenModelItem,
  CodegenModelPlan,
  CodegenPayload
} from "@/api/system/codegen";
import {
  buildBatchPayload,
  buildPayload,
  defaultFormState,
  type CodegenFormState
} from "./utils/payload";
import { useCodegenPlans } from "./utils/useCodegenPlans";
import { useCodegenDownload } from "./utils/useCodegenDownload";
import BaseConfig from "./components/BaseConfig.vue";
import OptionSwitches from "./components/OptionSwitches.vue";
import FieldConfigTable from "./components/FieldConfigTable.vue";
import AiDraftDialog from "./components/AiDraftDialog.vue";
import ArtifactPreview from "./components/ArtifactPreview.vue";
import SavedPlans from "./components/SavedPlans.vue";
import CodegenLoadError from "./components/CodegenLoadError.vue";

defineOptions({ name: "SystemCodeGen" });

const { t } = useI18n();

type Mode = "single" | "batch";

const mode = ref<Mode>("single");
const models = ref<CodegenModelItem[]>([]);
const modelsLoading = ref(false);
const batchModels = ref<string[]>([]);

/** 全量表单状态（生成方案的序列化单元） */
const state = reactive<CodegenFormState>(defaultFormState());
/**
 * 子组件 v-model 的写入目标。
 *
 * 不能把 v-model 直接绑到 reactive 根对象：编译器需要为绑定生成赋值语句，
 * 只能把 `const state` 降级成 `let` 并给出告警。子级本就是共享同一份对象、
 * 只做嵌套字段变更，这里用可写计算属性承接潜在的整体回吐（合并回 state），
 * 绑定保持可赋值形态。
 */
const stateModel = computed<CodegenFormState>({
  get: () => state,
  set: value => Object.assign(state, value)
});
const planData = ref<CodegenModelPlan | null>(null);
const planLoading = ref(false);
/** 载入保存方案时暂存其字段配置：等新模型计划返回后再回填（避免被默认重建覆盖） */
const pendingPlanState = ref<CodegenFormState | null>(null);

const fieldTableRef = ref<InstanceType<typeof FieldConfigTable>>();
const aiDraftRef = ref<InstanceType<typeof AiDraftDialog>>();
const canAiDraft = computed(
  () => Boolean(state.model) && hasAuth("aiDraft:SystemCodeGen")
);

/**
 * 采纳 AI 草案：合并进字段配置（人审后的最后一步）。采纳项按草案顺序居前
 * （pk 恒首），未触及字段保持原序殿后——与 apply_field_overrides 的顺序语义一致。
 */
function applyAiDraft(overrides: CodegenFieldOverride[]) {
  const draftNames = new Set(overrides.map(row => row.name));
  const byName = new Map(state.fields.map(row => [row.name, row]));
  const adopted = overrides.map(draft => ({
    ...(byName.get(draft.name) ?? { name: draft.name }),
    ...draft
  }));
  const pkRow = state.fields.find(row => row.name === "pk");
  const untouched = state.fields.filter(
    row => !draftNames.has(row.name) && row.name !== "pk"
  );
  state.fields = [...(pkRow ? [pkRow] : []), ...adopted, ...untouched];
}

const modelsError = ref("");
const planError = ref("");
const previewLoading = ref(false);
const previewError = ref("");
const artifacts = ref<CodegenArtifact[]>([]);
/** 实时预览：首次手动预览后，表单/字段变更自动防抖刷新右侧产物 */
const autoPreview = ref(true);
const hasPreviewed = ref(false);

const canPreview = computed(
  () => Boolean(state.model) && hasAuth("preview:SystemCodeGen")
);
// 模型清单与字段计划各有独立权限点：缺失时给出明确说明，而不是空下拉/空表
const canLoadModels = hasAuth("models:SystemCodeGen");
const canLoadFields = hasAuth("modelFields:SystemCodeGen");
const canDownload = computed(() =>
  mode.value === "batch" ? batchModels.value.length > 0 : Boolean(state.model)
);
const selectedLabel = computed(
  () => models.value.find(item => item.label === state.model) ?? null
);

async function loadModels() {
  if (!canLoadModels) return;
  modelsLoading.value = true;
  modelsError.value = "";
  try {
    const res = await systemCodeGenApi.models().catch(error => {
      modelsError.value = normalizeError(error).detail || t("results.failed");
      return null;
    });
    if (!res) return;
    if (!isSuccess(res)) {
      modelsError.value = String(res.detail ?? t("results.failed"));
      return;
    }
    models.value = res.data ?? [];
  } finally {
    modelsLoading.value = false;
  }
}

/** 模型变更 / 载入方案后的计划加载：默认命名 + 字段表重建（或回填方案字段） */
async function loadPlan(label: string) {
  // 切换模型先清场：请求失败时不再残留上一个模型的字段表与产物
  planData.value = null;
  state.fields = [];
  artifacts.value = [];
  hasPreviewed.value = false;
  if (!label) return;
  // 先落基线：无字段权限或计划请求失败时不应把「刚选完模型」判成未保存改动
  baselineSignature.value = payloadSignature.value;
  if (!canLoadFields) return;
  planLoading.value = true;
  planError.value = "";
  try {
    const res = await systemCodeGenApi.modelFields(label).catch(error => {
      planError.value = normalizeError(error).detail || t("results.failed");
      return null;
    });
    if (!res) return;
    if (!isSuccess(res) || !res.data) {
      planError.value = String(res.detail ?? t("results.failed"));
      return;
    }
    planData.value = res.data;
    if (pendingPlanState.value) {
      // 载入保存方案：命名与字段配置以方案为准（仅保留当前模型仍存在的字段）
      const saved = pendingPlanState.value;
      pendingPlanState.value = null;
      state.fields = saved.fields.filter(field =>
        (res.data?.fields ?? []).some(item => item.name === field.name)
      );
    } else {
      state.component = res.data.defaults.component;
      state.url_prefix = res.data.defaults.url_prefix;
      state.frontend_dir = res.data.defaults.frontend_dir;
      fieldTableRef.value?.rebuild(res.data);
    }
    // 模型计划装配完成即基线：后续字段/命名改动才触发离开确认
    baselineSignature.value = payloadSignature.value;
  } finally {
    planLoading.value = false;
  }
}

const {
  savedPlans,
  refreshPlans,
  onSavePlan,
  onLoadPlan,
  onUpdatePlan,
  onRemovePlan,
  onImportPlans
} = useCodegenPlans({
  t,
  state,
  pendingPlanState,
  loadPlan
});

function buildSinglePayload(): CodegenPayload {
  return buildPayload(state);
}

async function runPreview() {
  if (!state.model) return;
  previewLoading.value = true;
  previewError.value = "";
  try {
    const res = await systemCodeGenApi
      .preview(buildSinglePayload())
      .catch(error => {
        previewError.value =
          normalizeError(error).detail || t("results.failed");
        return null;
      });
    if (!res) return;
    if (!isSuccess(res)) {
      previewError.value = String(res.detail ?? t("results.failed"));
      return;
    }
    artifacts.value = res.data ?? [];
  } finally {
    previewLoading.value = false;
  }
}

async function handlePreview() {
  if (!state.model) return;
  hasPreviewed.value = true;
  await runPreview();
}

/** 实时预览：载荷签名变化 → 600ms 防抖静默刷新（模型切换由 loadPlan 清场，不触发） */
let previewTimer: ReturnType<typeof setTimeout> | null = null;
const payloadSignature = computed(() => JSON.stringify(buildSinglePayload()));
/** 当前模型计划装配完成时的载荷快照：与实时载荷比较判定草稿是否改动 */
const baselineSignature = ref("");
const dirty = computed(
  () =>
    mode.value === "single" &&
    Boolean(state.model) &&
    payloadSignature.value !== baselineSignature.value
);
useDesignerGuard({ dirty, namespace: "codegen" });

const { downloadLoading, downloadError, handleDownload } = useCodegenDownload({
  t,
  mode,
  batchModels,
  state,
  payloadSignature,
  baselineSignature,
  buildSinglePayload,
  buildBatchPayload: () => buildBatchPayload(batchModels.value, state)
});

watch(payloadSignature, () => {
  if (mode.value !== "single" || !hasPreviewed.value || !autoPreview.value)
    return;
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    previewTimer = null;
    if (hasPreviewed.value && autoPreview.value) void runPreview();
  }, 600);
});
onBeforeUnmount(() => {
  if (previewTimer) clearTimeout(previewTimer);
});

onMounted(() => {
  loadModels();
  void refreshPlans();
});
</script>

<template>
  <RePage>
    <el-card shadow="never">
      <template #header>
        <div class="flex-bc gap-2 flex-wrap">
          <span class="font-medium">{{ t("menus.codeGenerator") }}</span>
          <div class="flex items-center gap-2 flex-wrap">
            <el-radio-group v-model="mode" size="small">
              <el-radio-button value="single">
                {{ t("codegen.modeSingle") }}
              </el-radio-button>
              <el-radio-button value="batch">
                {{ t("codegen.modeBatch") }}
              </el-radio-button>
            </el-radio-group>
            <SavedPlans
              :plans="savedPlans"
              @save="onSavePlan"
              @load="onLoadPlan"
              @remove="onRemovePlan"
              @update="onUpdatePlan"
              @import-plans="onImportPlans"
            />
          </div>
        </div>
      </template>
      <el-row :gutter="16">
        <!-- 左：模型与配置 -->
        <el-col :xs="24" :md="10">
          <el-alert
            v-if="!canLoadModels"
            :title="t('codegen.modelsDenied')"
            type="warning"
            :closable="false"
            show-icon
            class="mb-2!"
          />
          <el-alert
            v-else-if="!canLoadFields"
            :title="t('codegen.fieldsDenied')"
            type="warning"
            :closable="false"
            show-icon
            class="mb-2!"
          />
          <CodegenLoadError
            v-if="modelsError"
            :title="t('codegen.modelsLoadFailed')"
            :detail="modelsError"
            @retry="loadModels"
          />
          <BaseConfig
            v-if="mode === 'single'"
            v-model="stateModel"
            :models="models"
            :models-loading="modelsLoading"
            :plan-loading="planLoading"
            @model-change="loadPlan"
          />
          <el-form v-else label-width="90px" label-position="left" class="mb-2">
            <el-form-item :label="t('codegen.model')" required>
              <el-select
                v-model="batchModels"
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                :loading="modelsLoading"
                :placeholder="t('codegen.batchModelPlaceholder')"
              >
                <el-option
                  v-for="item in models"
                  :key="item.label"
                  :value="item.label"
                  :label="`${item.label}（${item.verbose_name}）`"
                />
              </el-select>
            </el-form-item>
          </el-form>
          <el-alert
            v-if="mode === 'batch'"
            :title="t('codegen.batchTip')"
            type="info"
            :closable="false"
            class="mb-2!"
          />
          <OptionSwitches v-model="stateModel" />
          <template v-if="mode === 'single'">
            <div class="flex-bc gap-2">
              <el-divider content-position="left" class="flex-1 my-2!">
                {{ t("codegen.fieldConfig") }}
              </el-divider>
              <el-tooltip
                v-if="hasAuth('aiDraft:SystemCodeGen')"
                :content="state.model ? '' : t('codegen.aiDraftNeedModel')"
                placement="top"
              >
                <span>
                  <el-button
                    size="small"
                    :icon="MagicStick"
                    :disabled="!canAiDraft"
                    data-testid="ai-draft-open"
                    @click="aiDraftRef?.open()"
                  >
                    {{ t("codegen.aiDraft") }}
                  </el-button>
                </span>
              </el-tooltip>
            </div>
            <CodegenLoadError
              v-if="planError"
              :title="t('codegen.planLoadFailed')"
              :detail="planError"
              @retry="loadPlan(state.model)"
            />
            <FieldConfigTable
              v-show="planData"
              ref="fieldTableRef"
              v-model="state.fields"
              :plan="planData"
              :dict-types="planData?.dict_types ?? []"
            />
            <ReEmpty
              v-if="!planData && !planLoading"
              :description="t('codegen.planEmpty')"
              :image-size="60"
            />
            <el-form-item class="mt-3!">
              <el-button
                v-if="hasAuth('preview:SystemCodeGen')"
                type="primary"
                :icon="MagicStick"
                :loading="previewLoading"
                :disabled="!canPreview"
                @click="handlePreview"
              >
                {{ t("codegen.preview") }}
              </el-button>
              <el-button
                v-if="hasAuth('download:SystemCodeGen')"
                :icon="Download"
                :loading="downloadLoading"
                :disabled="!canDownload"
                @click="handleDownload"
              >
                {{ t("codegen.download") }}
              </el-button>
              <el-checkbox v-model="autoPreview" class="ml-2!">
                {{ t("codegen.autoPreview") }}
              </el-checkbox>
            </el-form-item>
            <div v-if="downloadError" class="mt-2">
              <el-alert
                type="error"
                :closable="false"
                show-icon
                :title="t('codegen.downloadFailed')"
                :description="downloadError"
              />
            </div>
          </template>
          <el-form-item v-else class="mt-3!">
            <el-button
              v-if="hasAuth('download:SystemCodeGen')"
              type="primary"
              :icon="Download"
              :loading="downloadLoading"
              :disabled="!canDownload"
              @click="handleDownload"
            >
              {{ t("codegen.batchDownload") }}
            </el-button>
          </el-form-item>
          <div v-if="downloadError" class="mt-2">
            <el-alert
              type="error"
              :closable="false"
              show-icon
              :title="t('codegen.downloadFailed')"
              :description="downloadError"
            />
          </div>
        </el-col>
        <!-- 右：产物预览 -->
        <el-col :xs="24" :md="14">
          <el-alert
            v-if="mode === 'single' && selectedLabel"
            :title="`${selectedLabel.label} → ${t('codegen.artifactTip')}`"
            type="info"
            :closable="false"
            class="mb-2!"
          />
          <template v-if="mode === 'single'">
            <div v-if="previewError" class="mb-2 flex items-start gap-2">
              <el-alert
                class="flex-1"
                type="error"
                :closable="false"
                show-icon
                :title="t('codegen.previewLoadFailed')"
                :description="previewError"
              />
              <el-button link type="primary" @click="runPreview">
                {{ t("plus.retry") }}
              </el-button>
            </div>
            <ArtifactPreview
              v-if="artifacts.length"
              :artifacts="artifacts"
              :loading="previewLoading"
            />
            <ReEmpty v-else :description="t('codegen.previewEmptyTip')" />
          </template>
          <ReEmpty v-else :description="t('codegen.batchPreviewEmpty')" />
        </el-col>
      </el-row>
      <AiDraftDialog
        v-if="mode === 'single'"
        ref="aiDraftRef"
        :model="state.model"
        @apply="applyAiDraft"
      />
    </el-card>
  </RePage>
</template>
