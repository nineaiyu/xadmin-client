<script lang="ts" setup>
import { ref, watch } from "vue";
import { FieldValues, PlusColumn, PlusForm } from "plus-pro-components";
import { ExportImportFormatOptions } from "../utils/constants";
import UploadIcon from "@iconify-icons/ri/upload-2-line";
import { useI18n } from "vue-i18n";
import { renderBooleanSegmentedOption } from "@/components/RePlusPage";

const formRef = ref();

defineOptions({ name: "ImportData" });

interface FormItemProps {
  action: string;
  ignore_error: boolean;
  upload: any[];
  api: { export: Function };
}

interface FormProps {
  formInline: Partial<FieldValues & FormItemProps>;
  formProps?: object;
  columns?: PlusColumn[];
}

const props = withDefaults(defineProps<FormProps>(), {
  formInline: () => ({
    action: "create",
    ignore_error: false,
    upload: [],
    api: {
      export: null
    }
  })
});
const { t } = useI18n();

const state = ref<FormProps["formInline"]>(props.formInline);
const formColumns: PlusColumn[] = [
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
    label: t("exportImport.ignoreError"),
    prop: "ignore_error",
    renderField: renderBooleanSegmentedOption()
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
  state.value.api?.export({
    type: type,
    template: template,
    action: state.value.action,
    ignore_error: state.value.ignore_error
  });
};
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
      <el-col :offset="6" :span="12">
        {{
          t("exportImport.downloadTip", {
            action:
              state.action == "create"
                ? t("exportImport.create")
                : t("exportImport.update")
          })
        }}
        <el-link
          v-for="item in ExportImportFormatOptions"
          :key="item.label"
          class="ml-2"
          type="primary"
          @click="goDownloadXlsx(item.value)"
          >{{ item.label }}
        </el-link>
      </el-col>
    </template>
    <template #plus-field-upload>
      <el-upload
        ref="uploadRef"
        v-model:file-list="state.upload"
        :auto-upload="false"
        accept=".xls,.xlsx,.csv"
        action="#"
        class="!w-[300px]"
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
