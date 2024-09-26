<script lang="ts" setup>
import { computed, ref } from "vue";
import { FieldValues, PlusColumn, PlusDescriptions } from "plus-pro-components";
import { deviceDetection } from "@pureadmin/utils";

interface DetailFormProps {
  formInline: FieldValues;
  formProps?: object;
  columns: PlusColumn[];
}

const props = withDefaults(defineProps<DetailFormProps>(), {
  formInline: () => ({}),
  formProps: () => ({}),
  columns: () => []
});

const formRef = ref();
const newFormInline = ref<FieldValues>(props.formInline);

function getRef() {
  return formRef.value?.formInstance;
}

defineOptions({ name: "DetailData" });
defineExpose({ getRef });
const column = computed(() => (deviceDetection() ? 1 : 2));
</script>

<template>
  <PlusDescriptions
    ref="formRef"
    :column="column"
    :columns="columns"
    :data="newFormInline"
    v-bind="formProps"
  />
</template>
