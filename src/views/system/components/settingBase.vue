<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { handleOperation, useBaseColumns } from "@/components/RePlusCRUD";
import { PlusForm } from "plus-pro-components";
import { cloneDeep } from "lodash-es";
import { useI18n } from "vue-i18n";
import { ViewBaseApi } from "@/api/base";

defineOptions({
  name: "SettingBase"
});

const emit = defineEmits<{
  (e: "submit", ...args: any[]): void;
}>();

interface FormProps {
  api: ViewBaseApi;
  title?: string;
  localeName?: string;
  autoSubmit?: boolean;
  formProps?: object;
  auth?: {
    update: boolean;
    detail: boolean;
  };
}

const props = withDefaults(defineProps<FormProps>(), {
  api: undefined,
  title: undefined,
  localeName: "",
  autoSubmit: true,
  formProps: () => ({}),
  auth: () => ({
    update: false,
    detail: false
  })
});

const { t } = useI18n();

const { getColumnData } = useBaseColumns(props.localeName);
const addOrEditData = ref({
  addOrEditRules: {},
  addOrEditColumns: [],
  defaultData: {},
  formData: {}
});

onMounted(() => {
  props.auth.detail &&
    getColumnData(
      props.api.columns,
      undefined,
      ({ addOrEditRules, addOrEditColumns, addOrEditDefaultValue }) => {
        addOrEditData.value.addOrEditRules = cloneDeep(addOrEditRules.value);
        addOrEditData.value.addOrEditColumns = cloneDeep(
          addOrEditColumns.value
        );
        addOrEditData.value.addOrEditColumns.forEach(column => {
          column["colProps"] = {};
          column["fieldProps"]["disabled"] = !props.auth.update;
        });
        addOrEditData.value.formData = cloneDeep(addOrEditDefaultValue.value);
        props.api.detail().then(res => {
          if (res.code === 1000) {
            addOrEditData.value.formData = res.data;
            addOrEditData.value.defaultData = cloneDeep(
              addOrEditData.value.formData
            );
          }
        });
      }
    );
});

const handleSubmitSettings = data => {
  emit("submit", data);
  props.autoSubmit &&
    handleOperation({
      t,
      apiReq: props.api.patch(data),
      success: ({ data }) => {
        addOrEditData.value.defaultData = data;
      }
    });
};
</script>

<template>
  <el-card>
    <template #header> {{ t(`${localeName}.${title ?? "title"}`) }} </template>
    <PlusForm
      ref="addFormRef"
      v-model="addOrEditData.formData"
      :columns="addOrEditData.addOrEditColumns"
      :rules="addOrEditData.addOrEditRules"
      :default-values="cloneDeep(addOrEditData.defaultData)"
      :row-props="{ gutter: 24 }"
      class="mr-12 ml-12 m-5"
      label-position="left"
      label-width="200px"
      :has-footer="auth.update"
      v-bind="formProps"
      @submit="handleSubmitSettings"
    />
  </el-card>
</template>
