<script lang="ts" setup>
import { ref } from "vue";
import { FormProps } from "./utils/types";
import { useDemoBookForm } from "./utils/hook";

const props = withDefaults(defineProps<FormProps>(), {
  isAdd: () => true,
  showColumns: () => [],
  formInline: () => ({})
});

const formRef = ref();
const { columns } = useDemoBookForm(props);
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
  />
</template>
