<script lang="ts" setup>
import { computed, ref } from "vue";
import { FieldValues, PlusColumn, PlusForm } from "plus-pro-components";
import { ExportImportFormatOptions } from "../utils/constants";
import { useI18n } from "vue-i18n";

const formRef = ref();

defineOptions({ name: "ExportData" });

interface FormItemProps {
  type: string;
  range: string;
  pks: Array<number>;
  /** 大数据量异步导出：提交后台任务，产物在下载中心下载 */
  async?: boolean;
}

interface FormProps {
  formInline?: Partial<FieldValues & FormItemProps>;
  formProps?: object;
  columns?: PlusColumn[];
  allowTypes?: string[];
  allowAsync?: boolean;
}

const props = withDefaults(defineProps<FormProps>(), {
  allowTypes: () => ["all", "search", "selected"],
  allowAsync: false,
  formInline: () => ({
    type: "xlsx",
    range: "all",
    pks: [],
    async: false
  })
});
const { t } = useI18n();

// state 必须与 props.formInline 保持同引用：openDialogDrawer 的 beforeSure 从
// options.props.formInline 收集提交值，「同引用共享」是本组件与 AddOrEdit 的既有
// 值回传契约（PlusForm 的 v-model 直接写入该共享对象），不能展开成新对象。
// formInline 必传时 withDefaults 的默认值不生效，缺键字段（如异步导出 async）
// 会是 undefined —— 不在 ElSwitch active/inactive 值域内，挂载即报 model-value
// 警告，故仅在共享对象上补齐缺失键（缺省口径与上方默认值一致）
const state = ref<NonNullable<FormProps["formInline"]>>(props.formInline ?? {});
if (state.value.type === undefined) state.value.type = "xlsx";
if (state.value.range === undefined) state.value.range = "all";
if (state.value.pks === undefined) state.value.pks = [];
if (state.value.async === undefined) state.value.async = false;
const formColumns: PlusColumn[] = [
  {
    label: t("exportImport.type"),
    prop: "type",
    valueType: "radio",
    options: ExportImportFormatOptions
  },
  {
    label: t("exportImport.exportRange"),
    prop: "range",
    valueType: "radio",
    options: computed(() => {
      return [
        { label: t("exportImport.exportAll"), value: "all" },
        {
          label: t("exportImport.exportSelected"),
          value: "selected",
          fieldItemProps: {
            disabled: computed(() => {
              return state.value.pks?.length == 0;
            })
          }
        },
        { label: t("exportImport.exportFiltered"), value: "search" }
      ].filter(item => props.allowTypes.indexOf(item.value) > -1);
    })
  }
];

if (props.allowAsync) {
  formColumns.push({
    label: t("exportImport.asyncExport"),
    prop: "async",
    valueType: "switch",
    tooltip: t("exportImport.asyncTip"),
    // 显式声明开关值域，避免 ElSwitch 因缺 inactive-value 发出开发态警告
    fieldProps: {
      activeValue: true,
      inactiveValue: false
    }
  });
}

function getRef() {
  return formRef.value?.formInstance;
}

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
  />
</template>
