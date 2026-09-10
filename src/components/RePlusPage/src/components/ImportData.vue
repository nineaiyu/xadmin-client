<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { FieldValues, PlusColumn, PlusForm } from "plus-pro-components";
import { ExportImportFormatOptions } from "../utils/constants";
import UploadIcon from "~icons/ri/upload-2-line";
import { useI18n } from "vue-i18n";
import { renderBooleanSegmentedOption } from "@/components/RePlusPage";
import { message } from "@/utils/message";
import type { UploadUserFile } from "element-plus";
import type {
  DetailResult,
  ImportHeadersResult,
  ImportTemplateItem,
  ListResult
} from "@/api/types";

const formRef = ref();

defineOptions({ name: "ImportData" });

/** 导入链路用到的通用 API 契约（由页面 api 实例实现，见 api/base.ts） */
interface ImportDataApi {
  exportData?: (_params: object) => unknown;
  importHeaders?: (
    _params: object,
    _file: File
  ) => Promise<ImportHeadersResult>;
  importTemplates?: (
    _params?: object
  ) => Promise<ListResult<ImportTemplateItem>>;
  createImportTemplate?: (_data?: object) => Promise<DetailResult>;
}

interface FormItemProps {
  /** 模板格式（与导出弹窗的文件类型同源选项，仅用于下载模板） */
  type: string;
  action: string;
  ignore_error: boolean;
  /** 执行方式：导入（含异步）/ 仅校验 */
  mode: "import" | "validate";
  async: boolean;
  upload: UploadUserFile[];
  /** 列映射：原始表头 → 目标字段名（空串 = 忽略该列） */
  mapping: Record<string, string>;
  /** 套用的模板主键；用户手动改动映射后清空，避免模板覆盖手工映射 */
  template_id: string;
  /** 未映射列是否丢弃（后端 ignore_unknown，默认 true＝丢弃） */
  ignore_unknown: boolean;
  api: ImportDataApi;
}

interface FormProps {
  formInline?: Partial<FieldValues & FormItemProps>;
  formProps?: object;
  columns?: PlusColumn[];
}

const props = withDefaults(defineProps<FormProps>(), {
  formInline: () => ({
    type: "xlsx",
    action: "create",
    ignore_error: false,
    mode: "import",
    async: false,
    upload: [],
    mapping: {},
    template_id: "",
    ignore_unknown: true,
    api: {
      exportData: null
    }
  })
});
const { t } = useI18n();

const state = ref<FormProps["formInline"]>(props.formInline);

/** 表头解析结果（列映射面板数据源） */
const headers = ref<string[]>([]);
const candidates = ref<string[]>([]);
const fieldOptions = ref<ImportHeadersResult["data"]["fields"]>([]);
const modelLabel = ref("");
const headersReady = ref(false);
const parsing = ref(false);

/** 模板列表与当前选中项 */
const templates = ref<ImportTemplateItem[]>([]);
const selectedTemplate = ref("");
const newTemplateName = ref("");
/** 保留未映射列（未勾选 = 丢弃，与后端 ignore_unknown 默认一致） */
const keepUnknown = computed({
  get: () => state.value.ignore_unknown === false,
  set: (value: boolean) => {
    state.value.ignore_unknown = !value;
  }
});

const mappingRows = computed(() =>
  headers.value.map((header, index) => ({
    header,
    candidate: candidates.value[index] ?? "",
    field: state.value.mapping?.[header] ?? ""
  }))
);

const templateOptions = computed(() =>
  templates.value.map(item => ({
    value: item.pk,
    label: item.is_shared
      ? `${item.name}（${t("exportImport.templateShared")}）`
      : item.name
  }))
);

/** 归一化等名候选填默认值：无候选的列留空（= 忽略），由用户手动选择 */
const buildDefaultMapping = () => {
  const mapping: Record<string, string> = {};
  headers.value.forEach((header, index) => {
    mapping[header] = candidates.value[index] ?? "";
  });
  return mapping;
};

const applyMapping = (mapping: Record<string, string>) => {
  state.value.mapping = mapping;
};

const loadTemplates = async () => {
  if (!state.value.api?.importTemplates || !modelLabel.value) return;
  const res = await state.value.api.importTemplates({
    model: modelLabel.value,
    size: 100
  });
  if (res?.code === 1000) {
    templates.value = res.data.results ?? [];
  }
};

/** 选中文件后解析首行表头：拿到目标模型、目标字段候选与模板列表 */
const parseHeaders = async (file: File) => {
  if (!state.value.api?.importHeaders) return;
  parsing.value = true;
  try {
    const res = await state.value.api.importHeaders({}, file);
    if (res.code !== 1000) {
      message(res.detail || t("exportImport.mappingParseFailed"), {
        type: "warning"
      });
      return;
    }
    headers.value = res.data.headers ?? [];
    candidates.value = res.data.candidates ?? [];
    fieldOptions.value = res.data.fields ?? [];
    modelLabel.value = res.data.model ?? "";
    headersReady.value = headers.value.length > 0;
    selectedTemplate.value = "";
    newTemplateName.value = "";
    applyMapping(buildDefaultMapping());
    state.value.template_id = "";
    await loadTemplates();
  } catch {
    // HTTP 异常（拦截器已 toast）：不阻塞上传，按旧行为（无映射）继续
    headersReady.value = false;
  } finally {
    parsing.value = false;
  }
};

/** 用户手改映射：清空模板绑定，提交时改走 mapping 明文 */
const updateMapping = (header: string, value: string) => {
  applyMapping({ ...(state.value.mapping ?? {}), [header]: value ?? "" });
  selectedTemplate.value = "";
  state.value.template_id = "";
};

const onSelectTemplate = (pk: string) => {
  selectedTemplate.value = pk;
  state.value.template_id = pk;
  const template = templates.value.find(item => item.pk === pk);
  if (!template) {
    state.value.template_id = "";
    return;
  }
  // 模板映射按表头键匹配：缺失的列回落到等名候选，避免套用后丢列
  const mapping: Record<string, string> = {};
  headers.value.forEach((header, index) => {
    mapping[header] =
      template.mapping?.[header] ?? candidates.value[index] ?? "";
  });
  applyMapping(mapping);
};

const saveTemplate = async () => {
  if (!state.value.api?.createImportTemplate) return;
  const name = newTemplateName.value.trim();
  if (!name) {
    message(t("exportImport.templateNameRequired"), { type: "warning" });
    return;
  }
  const res = await state.value.api.createImportTemplate({
    model: modelLabel.value,
    name,
    mapping: state.value.mapping ?? {},
    options: { ignore_unknown: state.value.ignore_unknown !== false },
    is_shared: false
  });
  if (res.code === 1000) {
    message(t("exportImport.templateSaved"), { type: "success" });
    newTemplateName.value = "";
    await loadTemplates();
    const created = templates.value.find(item => item.name === name);
    if (created) {
      onSelectTemplate(created.pk);
    }
  }
};

function getRef() {
  return formRef.value?.formInstance;
}

const goDownloadXlsx = (type: string) => {
  let template = "import";
  if (state.value.action === "update") {
    template = "update";
  }
  state.value.api?.exportData?.({
    type: type,
    template: template,
    action: state.value.action,
    ignore_error: state.value.ignore_error
  });
};
/** 按所选格式下载模板（与导出弹窗的格式 radio 联动） */
const goDownloadTemplate = () => goDownloadXlsx(state.value.type);

/** 已解析表头的文件标识：避免裁剪/重渲染触发重复解析 */
const parsedUid = ref<number | string>("");
watch(
  () => state.value.upload?.[0]?.uid,
  uid => {
    const files = state.value.upload ?? [];
    if (files.length > 1) {
      files.shift();
    }
    const file = files?.[0]?.raw;
    if (!file) {
      headersReady.value = false;
      parsedUid.value = "";
      return;
    }
    if (uid !== parsedUid.value) {
      parsedUid.value = uid;
      parseHeaders(file);
    }
  }
);

const formColumns: PlusColumn[] = [
  {
    // 模板格式与导出弹窗的「文件类型」同构（ExportImportFormatOptions 同源）
    label: t("exportImport.type"),
    prop: "type",
    valueType: "radio",
    options: ExportImportFormatOptions
  },
  {
    label: t("exportImport.import"),
    prop: "action",
    valueType: "radio",
    options: [
      { label: t("exportImport.create"), value: "create" },
      { label: t("exportImport.update"), value: "update" }
    ]
  },
  {
    label: t("exportImport.mode"),
    prop: "mode",
    valueType: "radio",
    options: [
      { label: t("exportImport.modeImport"), value: "import" },
      { label: t("exportImport.modeValidate"), value: "validate" }
    ]
  },
  {
    label: t("exportImport.async"),
    prop: "async",
    valueType: "switch",
    tooltip: t("exportImport.asyncImportTip"),
    // 仅校验不落库，无异步一说（saveCallback 在校验分支忽略该值）
    fieldProps: {
      activeValue: true,
      inactiveValue: false
    }
  },
  {
    label: t("exportImport.ignoreError"),
    prop: "ignore_error",
    renderField: renderBooleanSegmentedOption(),
    tooltip: t("exportImport.ignoreErrorAsyncTip")
  },
  {
    prop: "tips",
    hasLabel: false
  },
  {
    label: t("exportImport.upload"),
    prop: "upload",
    formItemProps: {
      rules: [{ required: true, message: t("exportImport.uploadRuleTip") }]
    }
  },
  {
    label: t("exportImport.mappingStep"),
    prop: "mapping",
    hasLabel: false
  }
];

defineExpose({ getRef });
</script>

<template>
  <PlusForm
    ref="formRef"
    v-model="state"
    :columns="formColumns"
    :hasFooter="false"
    :row-props="{ gutter: 24 }"
    class="m-5"
    label-position="left"
    label-width="140px"
  >
    <template #plus-field-tips>
      <el-col :span="24">
        <div class="ml-35">
          {{
            t("exportImport.downloadTip", {
              action:
                state.action == "create"
                  ? t("exportImport.create")
                  : t("exportImport.update")
            })
          }}
          <el-link class="ml-2" type="primary" @click="goDownloadTemplate">
            {{ t("exportImport.downloadTemplate") }}
          </el-link>
        </div>
      </el-col>
    </template>
    <template #plus-field-upload>
      <el-upload
        ref="uploadRef"
        v-model:file-list="state.upload"
        :auto-upload="false"
        accept=".xls,.xlsx,.csv"
        action="#"
        class="w-75!"
        drag
      >
        <div class="el-upload__text">
          <IconifyIconOffline
            :icon="UploadIcon"
            class="m-auto mb-2"
            width="26"
          />
          {{ t("exportImport.uploadTip") }}
        </div>
      </el-upload>
    </template>
    <template #plus-field-mapping>
      <el-col v-if="headersReady" v-loading="parsing" :span="24">
        <div class="ml-35 mr-5">
          <div class="mb-1 text-sm text-gray-500">
            {{ t("exportImport.mappingTip") }}
          </div>
          <div class="mb-2 flex flex-wrap items-center gap-2">
            <el-select
              v-model="selectedTemplate"
              class="w-50!"
              clearable
              filterable
              :placeholder="t('exportImport.templatePlaceholder')"
              @change="onSelectTemplate"
            >
              <el-option
                v-for="item in templateOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <el-input
              v-model="newTemplateName"
              class="w-40!"
              maxlength="64"
              :placeholder="t('exportImport.templateSavePlaceholder')"
            />
            <el-button plain type="primary" @click="saveTemplate">
              {{ t("exportImport.saveAsTemplate") }}
            </el-button>
            <el-tooltip
              :content="t('exportImport.ignoreUnknownTip')"
              placement="top"
            >
              <el-checkbox v-model="keepUnknown">
                {{ t("exportImport.ignoreUnknown") }}
              </el-checkbox>
            </el-tooltip>
          </div>
          <el-table :data="mappingRows" border max-height="240" size="small">
            <el-table-column
              :label="t('exportImport.mappingSource')"
              prop="header"
              show-overflow-tooltip
              width="180"
            />
            <el-table-column :label="t('exportImport.mappingTarget')">
              <template #default="{ row }">
                <el-select
                  :model-value="row.field"
                  class="w-full!"
                  clearable
                  filterable
                  :placeholder="t('exportImport.mappingIgnore')"
                  @update:model-value="
                    value => updateMapping(row.header, value)
                  "
                >
                  <el-option
                    :label="t('exportImport.mappingIgnore')"
                    value=""
                  />
                  <el-option
                    v-for="item in fieldOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column width="200">
              <template #default="{ row }">
                <el-tag v-if="row.candidate" size="small" type="success">
                  {{
                    t("exportImport.mappingMatched", { field: row.candidate })
                  }}
                </el-tag>
                <el-tag v-else size="small" type="info">
                  {{ t("exportImport.mappingUnmatched") }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
    </template>
  </PlusForm>
</template>
