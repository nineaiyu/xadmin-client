<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { handleOperation, useBaseColumns } from "@/components/RePlusPage";
import { PlusForm } from "plus-pro-components";
import { cloneDeep } from "lodash-es";
import { useI18n } from "vue-i18n";
import { settingItemProps } from "./types";

defineOptions({
  name: "SettingItem"
});

const emit = defineEmits<{
  (e: "submit", ...args: any[]): void;
}>();

const props = withDefaults(defineProps<settingItemProps>(), {
  api: undefined,
  title: undefined,
  localeName: "",
  autoSubmit: true,
  formProps: () => ({}),
  queryParams: () => ({}),
  auth: () => ({
    update: false,
    detail: false,
    test: false
  })
});

const { t } = useI18n();
const loading = ref(false);
const submitLoading = ref(false);
const testLoading = ref(false);
const { getColumnData } = useBaseColumns(props.localeName);
const addOrEditData = ref({
  addOrEditRules: {},
  addOrEditColumns: [],
  defaultData: {},
  formData: {}
});

onMounted(() => {
  if (props.auth.detail) {
    loading.value = true;
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

        props.api
          .detail(props.queryParams)
          .then(res => {
            if (res.code === 1000) {
              addOrEditData.value.formData = res.data;
              addOrEditData.value.defaultData = cloneDeep(
                addOrEditData.value.formData
              );
            }
          })
          .finally(() => {
            loading.value = false;
          });
      },
      undefined,
      props.queryParams
    );
  }
});

const handleSubmitSettings = data => {
  emit("submit", data);
  if (props.autoSubmit) {
    submitLoading.value = true;
    handleOperation({
      t,
      apiReq: props.api.patch(props.queryParams, data),
      success: ({ data }) => {
        addOrEditData.value.defaultData = data;
      },
      requestEnd: () => {
        submitLoading.value = false;
      }
    });
  }
};
const handleTest = () => {
  if (props.auth.test) {
    testLoading.value = true;
    handleOperation({
      t,
      apiReq: props.api.create(props.queryParams, addOrEditData.value.formData),
      requestEnd: () => {
        testLoading.value = false;
      }
    });
  }
};
</script>

<template>
  <PlusForm
    ref="addFormRef"
    v-model="addOrEditData.formData"
    v-loading="loading"
    :columns="addOrEditData.addOrEditColumns"
    :rules="addOrEditData.addOrEditRules"
    :default-values="cloneDeep(addOrEditData.defaultData)"
    :row-props="{ gutter: 24 }"
    class="mr-12 ml-12 m-5"
    label-position="left"
    label-width="300px"
    :has-footer="auth.update"
    v-bind="formProps"
    @submit="handleSubmitSettings"
  >
    <template #footer="{ handleSubmit, handleReset }">
      <div style="justify-content: flex-start">
        <el-button v-if="auth.update" @click="handleReset"
          >{{ t("buttons.reset") }}
        </el-button>

        <el-button
          v-if="auth.update"
          type="primary"
          :loading="submitLoading"
          @click="handleSubmit"
          >{{ t("buttons.save") }}
        </el-button>
        <el-button
          v-if="auth.test"
          type="success"
          :loading="testLoading"
          @click="handleTest"
          >{{ t("buttons.test") }}
        </el-button>
      </div>
    </template>
  </PlusForm>
</template>
