<script lang="ts" setup>
import { computed, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { MagicStick, Download } from "@element-plus/icons-vue";
import { message } from "@/utils/message";
import { hasAuth } from "@/router/utils";
import { systemCodeGenApi } from "@/api/system/codegen";
import type {
  CodegenArtifact,
  CodegenModelItem,
  CodegenModelPlan,
  CodegenPayload
} from "@/api/system/codegen";
import { downloadByData } from "@pureadmin/utils";

defineOptions({ name: "SystemCodeGen" });

const { t } = useI18n();

const models = ref<CodegenModelItem[]>([]);
const modelsLoading = ref(false);
const selectedModel = ref("");
const plan = ref<CodegenModelPlan | null>(null);
const planLoading = ref(false);

const form = reactive({
  component: "",
  url_prefix: "",
  frontend_dir: "",
  with_import_export: false,
  with_tags: false,
  with_module: false
});
/** 字段勾选：false = exclude（引擎推导为基准做减法，pk 恒保留） */
const fieldSelection = ref<Record<string, boolean>>({});
const previewLoading = ref(false);
const downloadLoading = ref(false);
const artifacts = ref<CodegenArtifact[]>([]);
const activeKey = ref("");

const selectedLabel = computed(
  () => models.value.find(item => item.label === selectedModel.value) ?? null
);
/** 未勾选字段 = exclude 清单 */
const excludeFields = computed(() =>
  Object.entries(fieldSelection.value)
    .filter(([, checked]) => !checked)
    .map(([name]) => name)
);
const activeArtifact = computed(
  () => artifacts.value.find(item => item.key === activeKey.value) ?? null
);

async function loadModels() {
  modelsLoading.value = true;
  try {
    const res = await systemCodeGenApi.models();
    if (res.code === 1000) models.value = res.data ?? [];
  } finally {
    modelsLoading.value = false;
  }
}

async function onModelChange(label: string) {
  plan.value = null;
  artifacts.value = [];
  if (!label) return;
  planLoading.value = true;
  try {
    const res = await systemCodeGenApi.modelFields(label);
    if (res.code !== 1000) return;
    plan.value = res.data ?? null;
    if (plan.value) {
      form.component = plan.value.defaults.component;
      form.url_prefix = plan.value.defaults.url_prefix;
      form.frontend_dir = plan.value.defaults.frontend_dir;
      // 初始勾选 = 引擎推导面（序列化器字段全量，表格列以 in_table 标注仅供参考）
      fieldSelection.value = Object.fromEntries(
        (plan.value.fields ?? []).map(field => [field.name, true])
      );
    }
  } finally {
    planLoading.value = false;
  }
}

function buildPayload(): CodegenPayload {
  const payload: CodegenPayload = {
    model: selectedModel.value,
    component: form.component || undefined,
    url_prefix: form.url_prefix || undefined,
    frontend_dir: form.frontend_dir || undefined,
    with_import_export: form.with_import_export,
    with_tags: form.with_tags,
    with_module: form.with_module
  };
  if (excludeFields.value.length) payload.exclude_fields = excludeFields.value;
  return payload;
}

async function handlePreview() {
  if (!selectedModel.value) return;
  previewLoading.value = true;
  try {
    const res = await systemCodeGenApi.preview(buildPayload());
    if (res.code !== 1000) return;
    artifacts.value = res.data ?? [];
    activeKey.value = artifacts.value[0]?.key ?? "";
  } finally {
    previewLoading.value = false;
  }
}

async function handleDownload() {
  if (!selectedModel.value) return;
  downloadLoading.value = true;
  try {
    const res = await systemCodeGenApi.download(buildPayload());
    downloadByData(
      res.data,
      `generated-${selectedModel.value.replace(".", "-")}.zip`
    );
    message(t("codegen.downloadStarted"), { type: "success" });
  } finally {
    downloadLoading.value = false;
  }
}

function artifactLabel(row: CodegenArtifact) {
  return row.path ? row.path.split("/").slice(-1)[0] : row.label;
}

loadModels();
</script>

<template>
  <div class="p-2">
    <el-card shadow="never">
      <template #header>
        <span class="font-medium">{{ t("menus.codeGenerator") }}</span>
      </template>
      <el-row :gutter="16">
        <!-- 左：模型与配置 -->
        <el-col :xs="24" :md="8">
          <el-form label-width="110px" label-position="left">
            <el-form-item :label="t('codegen.model')">
              <el-select
                v-model="selectedModel"
                filterable
                :loading="modelsLoading"
                :placeholder="t('codegen.modelPlaceholder')"
                @change="onModelChange"
              >
                <el-option
                  v-for="item in models"
                  :key="item.label"
                  :value="item.label"
                  :label="`${item.label}（${item.verbose_name}）`"
                />
              </el-select>
            </el-form-item>
            <el-form-item :label="t('codegen.component')">
              <el-input
                v-model="form.component"
                :placeholder="t('codegen.defaultDerive')"
              />
            </el-form-item>
            <el-form-item :label="t('codegen.urlPrefix')">
              <el-input
                v-model="form.url_prefix"
                :placeholder="t('codegen.defaultDerive')"
              />
            </el-form-item>
            <el-form-item :label="t('codegen.frontendDir')">
              <el-input
                v-model="form.frontend_dir"
                :placeholder="t('codegen.defaultDerive')"
              />
            </el-form-item>
            <el-form-item :label="t('codegen.options')">
              <el-checkbox v-model="form.with_import_export">
                {{ t("codegen.withImportExport") }}
              </el-checkbox>
              <el-checkbox v-model="form.with_tags">
                {{ t("codegen.withTags") }}
              </el-checkbox>
              <el-checkbox v-model="form.with_module">
                {{ t("codegen.withModule") }}
              </el-checkbox>
            </el-form-item>
            <el-form-item v-if="plan" :label="t('codegen.fields')">
              <div class="w-full">
                <el-checkbox
                  v-for="field in plan.fields"
                  :key="field.name"
                  v-model="fieldSelection[field.name]"
                  class="mr-2!"
                  :disabled="field.name === 'pk'"
                >
                  {{ field.name }}（{{ field.verbose_name }}）
                </el-checkbox>
              </div>
            </el-form-item>
            <el-form-item>
              <el-button
                v-if="hasAuth('preview:SystemCodeGen')"
                type="primary"
                :icon="MagicStick"
                :loading="previewLoading"
                :disabled="!selectedModel"
                @click="handlePreview"
              >
                {{ t("codegen.preview") }}
              </el-button>
              <el-button
                v-if="hasAuth('download:SystemCodeGen')"
                :icon="Download"
                :loading="downloadLoading"
                :disabled="!selectedModel"
                @click="handleDownload"
              >
                {{ t("codegen.download") }}
              </el-button>
            </el-form-item>
          </el-form>
        </el-col>
        <!-- 右：产物预览 -->
        <el-col :xs="24" :md="16">
          <el-alert
            v-if="selectedLabel"
            :title="`${selectedLabel.label} → ${t('codegen.artifactTip')}`"
            type="info"
            :closable="false"
            class="mb-2!"
          />
          <div v-if="artifacts.length" class="flex gap-2 h-140">
            <el-scrollbar class="w-56 shrink-0 border border-[#e5e7eb] rounded">
              <div
                v-for="item in artifacts"
                :key="item.key"
                class="px-3 py-2 cursor-pointer text-sm hover:bg-[#f5f7fa]"
                :class="{
                  'bg-[#ecf5ff] text-(--el-color-primary)':
                    item.key === activeKey
                }"
                @click="activeKey = item.key"
              >
                {{ artifactLabel(item) }}
                <div class="text-xs text-gray-400">
                  {{ item.path || item.notice }}
                </div>
              </div>
            </el-scrollbar>
            <el-card shadow="never" class="flex-1 overflow-hidden">
              <pre
                class="h-full m-0 overflow-auto text-xs/5 whitespace-pre"
              ><code>{{ activeArtifact?.content }}</code></pre>
            </el-card>
          </div>
          <el-empty v-else :description="t('codegen.previewEmpty')" />
        </el-col>
      </el-row>
    </el-card>
  </div>
</template>
