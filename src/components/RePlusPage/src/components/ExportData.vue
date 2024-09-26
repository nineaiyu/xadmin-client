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
}

interface FormProps {
  formInline: Partial<FieldValues & FormItemProps>;
  formProps?: object;
  columns?: PlusColumn[];
  allowTypes?: string[];
}

const props = withDefaults(defineProps<FormProps>(), {
  allowTypes: () => ["all", "search", "selected"],
  formInline: () => ({
    type: "xlsx",
    range: "all",
    pks: []
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
    label-width="140"
  />
</template>
