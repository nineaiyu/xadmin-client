<script lang="ts" setup>
import { ref } from "vue";
import { formRules } from "./utils/rule";
import { FormProps } from "./utils/types";

import filterForm from "./filter/index.vue";
import { ModeChoices } from "@/views/system/constants";
import { useDataPermissionForm } from "./utils/hook";

const props = withDefaults(defineProps<FormProps>(), {
  isAdd: () => true,
  showColumns: () => [],
  modeChoices: () => [],
  menuPermissionData: () => [],
  fieldLookupsData: () => [],
  valuesData: () => [],
  formInline: () => ({
    name: "",
    description: "",
    mode_type: ModeChoices.OR,
    rules: [],
    menu: [],
    is_active: true
  })
});

const formRef = ref();
const { columns } = useDataPermissionForm(props);
const newFormInline = ref(props.formInline);
function getRef() {
  return formRef.value?.formInstance;
}

defineExpose({ getRef });
</script>

<template>
  <PlusForm
    ref="formRef"
    v-model="newFormInline"
    :columns="columns"
    :hasFooter="false"
    :rules="formRules"
    :row-props="{ gutter: 24 }"
    label-position="right"
    label-width="100px"
  >
    <template #plus-field-rules>
      <filter-form
        v-model:data-list="newFormInline.rules"
        :disabled="!props.isAdd && props.showColumns.indexOf('rules') === -1"
        :rule-list="props.fieldLookupsData"
        :values-data="props.valuesData"
        class="overflow-auto"
      />
    </template>
  </PlusForm>
</template>
