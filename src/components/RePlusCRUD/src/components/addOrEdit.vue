<script lang="ts" setup>
import { ref } from "vue";
import { AddOrEditFormProps } from "../utils/types";

const props = withDefaults(defineProps<AddOrEditFormProps>(), {
  isAdd: () => true,
  showColumns: () => [],
  formInline: () => ({}),
  formProps: () => ({}),
  columns: () => []
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
    label-position="right"
    label-width="120px"
    v-bind="formProps"
  />
</template>
