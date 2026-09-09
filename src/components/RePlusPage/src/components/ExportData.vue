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

const state = ref<FormProps["formInline"]>(props.formInline);
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
