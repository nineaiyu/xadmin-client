<script lang="ts" setup>
import { SUCCESS_CODE } from "@/api/types";
import { computed, onMounted, ref, watch } from "vue";
import {
  handleOperation,
  useBaseColumns,
  type PageColumn
} from "@/components/RePlusPage";
import { PlusForm } from "plus-pro-components";
import type { FieldValues, PlusColumn, RecordType } from "plus-pro-components";
import { cloneDeep, pickBy } from "lodash-es";
import { useI18n } from "vue-i18n";
import { resolveSettingFieldSpan } from "@/views/settings/utils/settingLayout";
import { settingItemProps } from "./types";

defineOptions({
  name: "SettingItem"
});

const emit = defineEmits<{
  /** 透传 PlusForm 的 submit 事件载荷 */
  submit: [values: FieldValues];
  /** 表单值变化（含回显赋值；节流交给消费方，水印页据此实时预览） */
  change: [values: FieldValues];
}>();

const props = withDefaults(defineProps<settingItemProps>(), {
  api: undefined,
  title: undefined,
  localeName: "",
  autoSubmit: true,
  formProps: () => ({}),
  queryParams: () => ({}),
  onSaved: undefined,
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

/**
 * PlusForm 列：从框架列元数据逐项派生（plus-pro 必填 prop 补齐；
 * 框架列在 UnwrapRef 映射后按索引访问字段，避免交叉类型属性丢失）
 */
const formColumns = computed<PlusColumn[]>(() =>
  addOrEditData.value.addOrEditColumns.map(
    column =>
      ({
        ...column,
        prop: String(column["prop"] ?? "")
      }) as PlusColumn
  )
);

// 表单值变化对外广播（回显/编辑都会触发），水印页据此做实时预览
watch(
  () => addOrEditData.value.formData,
  values => emit("change", cloneDeep(values) as FieldValues),
  { deep: true }
);

/** 字段白名单过滤：设置页按渠道拆分页签时各页签只渲染/提交自己的字段 */
const keepField = (key: string) =>
  !props.fields?.length || props.fields.includes(key);

const getData = () => {
  if (props.auth.retrieve) {
    loading.value = true;
    // 首载并行：列元数据与当前配置同时发起（原先在列回调里串行补发 retrieve，
    // 两段 RTT 叠加拖慢首屏）；retrieve 异常归一为 null——网络层失败已有统一
    // 提示，此处不重复弹错，表单按列默认值兜底渲染
    const retrieveRes = props.api.retrieve(props.queryParams).catch(() => null);
    getColumnData(
      props.api.columns,
      undefined,
      ({ addOrEditRules, addOrEditColumns, addOrEditDefaultValue }) => {
        addOrEditData.value.addOrEditRules = cloneDeep(addOrEditRules.value);
        addOrEditData.value.addOrEditColumns = cloneDeep(
          addOrEditColumns.value
        ).filter(column => keepField(column.prop as string));
        addOrEditData.value.addOrEditColumns.forEach(column => {
          // 宽度按控件形态分配（长文本独占整行、开关最窄），不再一律拉满：
          // 后端的响应式默认值对设置页同样过宽，这里整体覆写
          column["colProps"] = resolveSettingFieldSpan(column["_column"]);
          (column["fieldProps"] as { disabled?: boolean })["disabled"] =
            !props.auth.partialUpdate;
        });
        addOrEditData.value.formData = pickBy(
          cloneDeep(addOrEditDefaultValue.value),
          (_value, key) => keepField(key)
        );

        retrieveRes
          .then(res => {
            if (res && res.code === SUCCESS_CODE) {
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
        // 保存成功后回调（如：水印配置变更后即时刷新当前会话的水印状态）
        void props.onSaved?.(data);
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
    class="setting-form"
    label-position="top"
    :has-footer="auth.partialUpdate"
    v-bind="formProps"
    @submit="handleSubmitSettings"
  >
    <template #footer="{ handleSubmit }">
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
    </template>
  </PlusForm>
</template>

<style lang="scss" scoped>
/**
 * 设置表单：标签置于控件上方（label-position="top"）。
 *
 * 设置项标签普遍较长（如「登录 MFA 令牌有效期（秒）」），左置标签必须预留固定
 * 宽度，短标签被撑出大片空白、长标签又会溢出压到控件上；上置标签按内容自然换行，
 * 列宽只由控件形态决定（见 utils/settingLayout.ts）。
 *
 * 按钮组（重置 / 保存 / 测试）左对齐紧贴最后一行的列位，与页签内容区左内边距同一
 * 条竖向轴线；按钮间距交给 EP 默认的 12px。
 */
.setting-form :deep(.plus-form__footer) {
  padding: 4px 0 0;
}
</style>
