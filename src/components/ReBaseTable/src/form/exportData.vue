<script lang="ts" setup>
import { computed, ref } from "vue";
import { PlusColumn, PlusForm } from "plus-pro-components";
import { FormatOptions } from "./constants";
import { useI18n } from "vue-i18n";

const formRef = ref();

defineOptions({ name: "exportData" });

interface FormItemProps {
  format: string;
  range: string;
  pks: Array<number>;
}

interface FormProps {
  formInline: FormItemProps;
}

const props = withDefaults(defineProps<FormProps>(), {
  formInline: () => ({
    format: "xlsx",
    range: "all",
    pks: []
  })
});
const { t } = useI18n();

const state = ref<FormItemProps>(props.formInline);
const columns: PlusColumn[] = [
  {
    label: t("exportImport.format"),
    prop: "format",
    valueType: "radio",
    options: FormatOptions
  },
  {
    label: t("exportImport.exportRange"),
    prop: "range",
    valueType: "radio",
    options: [
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
    ]
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
    :columns="columns"
    :hasFooter="false"
    :row-props="{ gutter: 24 }"
    class="m-5"
    label-position="left"
    label-width="140"
  />
</template>
