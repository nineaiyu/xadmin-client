<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { computed, onMounted, ref } from "vue";
import {
  handleOperation,
  useBaseColumns,
  type PageColumn
} from "@/components/RePlusPage";
import { PlusForm } from "plus-pro-components";
import type { FieldValues, PlusColumn, RecordType } from "plus-pro-components";
import { cloneDeep, pickBy } from "lodash-es";
import { useI18n } from "vue-i18n";
import { settingItemProps } from "./types";

defineOptions({
  name: "SettingItem"
});

const emit = defineEmits<{
  /** 透传 PlusForm 的 submit 事件载荷 */
  submit: [values: FieldValues];
}>();

const props = withDefaults(defineProps<settingItemProps>(), {
  api: undefined,
  title: undefined,
  localeName: "",
  autoSubmit: true,
  formProps: () => ({}),
  queryParams: () => ({}),
  auth: () => ({
    partialUpdate: false,
    retrieve: false,
    test: false
  })
});

const { t } = useI18n();
const loading = ref(false);
const submitLoading = ref(false);
const testLoading = ref(false);
const { getColumnData } = useBaseColumns(props.localeName);
const addOrEditData = ref<{
  addOrEditRules: RecordType;
  addOrEditColumns: PageColumn[];
  defaultData: RecordType;
  formData: RecordType;
}>({
  addOrEditRules: {},
  addOrEditColumns: [],
  defaultData: {},
  formData: {}
});

/** PlusForm 列（框架列元数据与 plus-pro 列在边界收窄） */
const formColumns = computed(
  () => addOrEditData.value.addOrEditColumns as unknown as PlusColumn[]
);

/** 字段白名单过滤：设置页按渠道拆分页签时各页签只渲染/提交自己的字段 */
const keepField = (key: string) =>
  !props.fields?.length || props.fields.includes(key);

const getData = () => {
  if (props.auth.retrieve) {
    loading.value = true;
    getColumnData(
      props.api.columns,
      undefined,
      ({ addOrEditRules, addOrEditColumns, addOrEditDefaultValue }) => {
        addOrEditData.value.addOrEditRules = cloneDeep(addOrEditRules.value);
        addOrEditData.value.addOrEditColumns = cloneDeep(
          addOrEditColumns.value
        ).filter(column => keepField(column.prop as string));
        addOrEditData.value.addOrEditColumns.forEach(column => {
          column["colProps"] = {};
          (column["fieldProps"] as { disabled?: boolean })["disabled"] =
            !props.auth.partialUpdate;
        });
        addOrEditData.value.formData = pickBy(
          cloneDeep(addOrEditDefaultValue.value),
          (_value, key) => keepField(key)
        );

        props.api
          .retrieve(props.queryParams)
          .then(res => {
            if (res.code === SUCCESS_CODE) {
              addOrEditData.value.formData = pickBy(res.data, (_value, key) =>
                keepField(key)
              );
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
};

onMounted(() => {
  getData();
});

const handleSubmitSettings = (data: FieldValues) => {
  emit("submit", data);
  if (props.autoSubmit) {
    submitLoading.value = true;
    handleOperation({
      t,
      apiReq: props.api.partialUpdate(props.queryParams, data),
      success: res => {
        addOrEditData.value.defaultData = res?.data ?? {};
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
    :columns="formColumns"
    :rules="addOrEditData.addOrEditRules"
    :default-values="cloneDeep(addOrEditData.defaultData)"
    :row-props="{ gutter: 24 }"
    class="mx-12 m-5"
    label-position="left"
    label-width="300px"
    :has-footer="auth.partialUpdate"
    v-bind="formProps"
    @submit="handleSubmitSettings"
  >
    <template #footer="{ handleSubmit }">
      <div style="justify-content: flex-start">
        <el-button v-if="auth.partialUpdate" @click="getData"
          >{{ t("buttons.reset") }}
        </el-button>

        <el-button
          v-if="auth.partialUpdate"
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
