<script lang="ts" setup>
import { ref, watch } from "vue";
import { FieldValues, PlusColumn, PlusForm } from "plus-pro-components";
import { ExportImportFormatOptions } from "../utils/constants";
import UploadIcon from "~icons/ri/upload-2-line";
import { useI18n } from "vue-i18n";
import { renderBooleanSegmentedOption } from "@/components/RePlusPage";
import type { UploadUserFile } from "element-plus";

const formRef = ref();

defineOptions({ name: "ImportData" });

interface FormItemProps {
  /** 模板格式（与导出弹窗的文件类型同源选项，仅用于下载模板） */
  type: string;
  action: string;
  ignore_error: boolean;
  /** 执行方式：导入（含异步）/ 仅校验 */
  mode: "import" | "validate";
  async: boolean;
  upload: UploadUserFile[];
  api: { exportData: (_params: object) => unknown };
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
    api: {
      exportData: null
    }
  })
});
const { t } = useI18n();

const state = ref<FormProps["formInline"]>(props.formInline);
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
  }
];

function getRef() {
  return formRef.value?.formInstance;
}

const goDownloadXlsx = (type: string) => {
  let template = "import";
  if (state.value.action === "update") {
    template = "update";
  }
  state.value.api?.exportData({
    type: type,
    template: template,
    action: state.value.action,
    ignore_error: state.value.ignore_error
  });
};
/** 按所选格式下载模板（与导出弹窗的格式 radio 联动） */
const goDownloadTemplate = () => goDownloadXlsx(state.value.type);
watch(
  () => state.value.upload,
  () => {
    if (state.value.upload.length > 1) {
      state.value.upload.shift();
    }
  }
);

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
  </PlusForm>
</template>
