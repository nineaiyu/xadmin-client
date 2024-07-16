<script lang="ts" setup>
import { ref } from "vue";
import { FieldValues, PlusColumn, PlusForm } from "plus-pro-components";

interface AddOrEditFormProps {
  formInline: FieldValues;
  formProps?: object;
  columns: PlusColumn[];
}

const props = withDefaults(defineProps<AddOrEditFormProps>(), {
  formInline: () => ({}),
  formProps: () => ({}),
  columns: () => []
});

const formRef = ref();
const newFormInline = ref<FieldValues>(props.formInline);

function getRef() {
  return formRef.value?.formInstance;
}
defineOptions({ name: "AddOrEditForm" });
defineExpose({ getRef });

const emit = defineEmits<{
  (e: "change", values: any): void;
}>();
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
    @change="
      (values, column) => {
        emit('change', { values, column });
      }
    "
  />
</template>
