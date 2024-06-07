<script lang="ts" setup>
import { ref, watch } from "vue";
import { PlusColumn, PlusForm } from "plus-pro-components";
import { FormatOptions } from "@/components/ReBaseTable/src/form/constants";
import UploadIcon from "@iconify-icons/ri/upload-2-line";
import { useI18n } from "vue-i18n";

const formRef = ref();

defineOptions({ name: "importData" });

interface FormItemProps {
  action: string;
  upload: any[];
  api: { export: Function };
}

interface FormProps {
  formInline: FormItemProps;
}

const props = withDefaults(defineProps<FormProps>(), {
  formInline: () => ({
    action: "create",
    upload: [],
    api: {
      export: null
    }
  })
});
const { t } = useI18n();

const state = ref<FormItemProps>(props.formInline);
const columns: PlusColumn[] = [
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

const goDownloadXlsx = (format: string) => {
  let template = "import";
  if (state.value.action === "update") {
    template = "update";
  }
  state.value.api?.export({
    format: format,
    template: template,
    action: state.value.action
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
    :columns="columns"
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
          v-for="item in FormatOptions"
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
