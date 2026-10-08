<script lang="ts" setup>
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
import { message } from "@/utils/message";
import { hasAuth } from "@/router/utils";
import { SUCCESS_CODE } from "@/api/types";
import { downloadByData } from "@pureadmin/utils";
import { systemCodeGenApi } from "@/api/system/codegen";
import type {
  CodegenArtifact,
  CodegenModelItem,
  CodegenModelPlan,
  CodegenPayload
} from "@/api/system/codegen";
import {
  buildBatchPayload,
  buildPayload,
  defaultFormState,
  normalizeFormState,
  type CodegenFormState
} from "./utils/payload";
import {
  importPlan,
  listPlans,
  removePlan,
  savePlan,
  type SavedPlan
} from "./utils/plan-storage";
import BaseConfig from "./components/BaseConfig.vue";
import OptionSwitches from "./components/OptionSwitches.vue";
import FieldConfigTable from "./components/FieldConfigTable.vue";
import ArtifactPreview from "./components/ArtifactPreview.vue";
import SavedPlans from "./components/SavedPlans.vue";

defineOptions({ name: "SystemCodeGen" });

const { t } = useI18n();

type Mode = "single" | "batch";

const mode = ref<Mode>("single");
const models = ref<CodegenModelItem[]>([]);
const modelsLoading = ref(false);
const batchModels = ref<string[]>([]);

/** 全量表单状态（生成方案的序列化单元） */
const state = reactive<CodegenFormState>(defaultFormState());
const planData = ref<CodegenModelPlan | null>(null);
const planLoading = ref(false);
/** 载入保存方案时暂存其字段配置：等新模型计划返回后再回填（避免被默认重建覆盖） */
const pendingPlanState = ref<CodegenFormState | null>(null);

const fieldTableRef = ref<InstanceType<typeof FieldConfigTable>>();

const previewLoading = ref(false);
const downloadLoading = ref(false);
const artifacts = ref<CodegenArtifact[]>([]);
/** 实时预览：首次手动预览后，表单/字段变更自动防抖刷新右侧产物 */
const autoPreview = ref(true);
const hasPreviewed = ref(false);

const savedPlans = ref<SavedPlan[]>([]);

const canPreview = computed(
  () => Boolean(state.model) && hasAuth("preview:SystemCodeGen")
);
const canDownload = computed(() =>
  mode.value === "batch" ? batchModels.value.length > 0 : Boolean(state.model)
);
const selectedLabel = computed(
  () => models.value.find(item => item.label === state.model) ?? null
);

async function loadModels() {
  modelsLoading.value = true;
  try {
    // http 层失败已统一提示，归一为 null：模型下拉保持空态
    const res = await systemCodeGenApi.models().catch(() => null);
    if (res?.code === SUCCESS_CODE) models.value = res.data ?? [];
  } finally {
    modelsLoading.value = false;
  }
}

/** 模型变更 / 载入方案后的计划加载：默认命名 + 字段表重建（或回填方案字段） */
async function loadPlan(label: string) {
  if (!label) {
    planData.value = null;
    state.fields = [];
    artifacts.value = [];
    hasPreviewed.value = false;
    return;
  }
  planLoading.value = true;
  try {
    // http 层失败已统一提示，归一为 null：计划区保持空态
    const res = await systemCodeGenApi.modelFields(label).catch(() => null);
    if (res?.code !== SUCCESS_CODE || !res.data) return;
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
  } finally {
    planLoading.value = false;
  }
}

function buildSinglePayload(): CodegenPayload {
  return buildPayload(state);
}

async function runPreview() {
  if (!state.model) return;
  previewLoading.value = true;
  try {
    // http 层失败已统一提示，归一为 null：产物区保持上次内容
    const res = await systemCodeGenApi
      .preview(buildSinglePayload())
      .catch(() => null);
    if (res?.code !== SUCCESS_CODE) return;
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

async function handleDownload() {
  if (mode.value === "batch" && !batchModels.value.length) {
    message(t("codegen.batchPickFirst"), { type: "warning" });
    return;
  }
  if (mode.value === "single" && !state.model) return;
  downloadLoading.value = true;
  try {
    const payload =
      mode.value === "batch"
        ? buildBatchPayload(batchModels.value, state)
        : buildSinglePayload();
    // http 层失败已统一提示，归一为 null：直接收尾，不触发下载
    const res = await systemCodeGenApi.download(payload).catch(() => null);
    if (!res) return;
    // 文件名与后端 download 同口径：单模型 generated-{model}.zip（点转连字符）；
    // 批量载荷无 model 字段，后端按其缺省值 codegen 命名
    const name =
      mode.value === "batch"
        ? "generated-codegen.zip"
        : `generated-${state.model.replace(".", "-")}.zip`;
    downloadByData(res.data, name);
    message(t("codegen.downloadStarted"), { type: "success" });
  } finally {
    downloadLoading.value = false;
  }
}

// ------------------------------------------------------------- 生成方案（服务端存储）
async function refreshPlans() {
  savedPlans.value = await listPlans();
}

async function onSavePlan(name: string, isShared: boolean) {
  try {
    savedPlans.value = await savePlan(
      name,
      { ...state, fields: [...state.fields] },
      isShared
    );
    message(t("codegen.planSaved"), { type: "success" });
  } catch (error) {
    message(
      `${t("codegen.planSaveFailed")}：${error instanceof Error ? error.message : error}`,
      { type: "error" }
    );
  }
}

function onLoadPlan(plan: SavedPlan) {
  const restored = normalizeFormState(plan.state);
  pendingPlanState.value = restored;
  Object.assign(state, restored);
  state.fields = [...restored.fields];
  if (state.model) void loadPlan(state.model);
  message(t("codegen.planLoaded"), { type: "success" });
}

async function onRemovePlan(pk: string) {
  try {
    savedPlans.value = await removePlan(pk);
    message(t("codegen.planDeleted"), { type: "success" });
  } catch (error) {
    message(
      `${t("codegen.planDeleteFailed")}：${error instanceof Error ? error.message : error}`,
      { type: "error" }
    );
  }
}

async function onImportPlans(json: string) {
  try {
    await importPlan(json);
    await refreshPlans();
    message(t("codegen.planImported"), { type: "success" });
  } catch (error) {
    message(
      `${t("codegen.planImportFailed")}：${error instanceof Error ? error.message : error}`,
      { type: "error" }
    );
  }
}

onMounted(() => {
  loadModels();
  void refreshPlans();
});
</script>

<template>
  <div class="p-2">
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
              @import-plans="onImportPlans"
            />
          </div>
        </div>
      </template>
      <el-row :gutter="16">
        <!-- 左：模型与配置 -->
        <el-col :xs="24" :md="10">
          <BaseConfig
            v-if="mode === 'single'"
            v-model="state"
            :models="models"
            :models-loading="modelsLoading"
            :plan-loading="planLoading"
            @model-change="loadPlan"
          />
          <el-form v-else label-width="92px" label-position="left" class="mb-2">
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
          <OptionSwitches v-model="state" />
          <template v-if="mode === 'single'">
            <el-divider content-position="left">
              {{ t("codegen.fieldConfig") }}
            </el-divider>
            <FieldConfigTable
              v-show="planData"
              ref="fieldTableRef"
              v-model="state.fields"
              :plan="planData"
              :dict-types="planData?.dict_types ?? []"
            />
            <el-empty
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
            <ArtifactPreview
              v-if="artifacts.length"
              :artifacts="artifacts"
              :loading="previewLoading"
            />
            <el-empty v-else :description="t('codegen.previewEmptyTip')" />
          </template>
          <el-empty v-else :description="t('codegen.batchPreviewEmpty')" />
        </el-col>
      </el-row>
    </el-card>
  </div>
</template>
