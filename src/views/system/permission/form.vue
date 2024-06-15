<script lang="ts" setup>
import { ref } from "vue";
import { formRules } from "./utils/rule";
import { FormProps } from "./utils/types";

import filterForm from "./filter/index.vue";
import { ModeChoices } from "@/views/system/constants";

const props = withDefaults(defineProps<FormProps>(), {
  isAdd: () => true,
  showColumns: () => [],
  fieldLookupsData: () => [],
  columns: () => [],
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
    :row-props="{ gutter: 24 }"
    :rules="formRules"
    label-position="right"
    label-width="120px"
  >
    <template #plus-field-rules>
      <filter-form
        v-model:data-list="newFormInline.rules"
        :disabled="!isAdd && showColumns.indexOf('rules') === -1"
        :rule-list="fieldLookupsData"
        :values-data="valuesData"
        class="overflow-auto"
      />
    </template>
  </PlusForm>
</template>
