<script lang="ts" setup>
import { ref } from "vue";
import { formRules } from "./utils/rule";
import { FormProps } from "./utils/types";
import { useUserConfigForm } from "./utils/hook";

const props = withDefaults(defineProps<FormProps>(), {
  isAdd: () => true,
  showColumns: () => [],
  formInline: () => ({
    key: "",
    value: "",
    owner: "",
    description: "",
    config_user: [],
    is_active: true,
    access: false
  })
});
const formRef = ref();
const { columns } = useUserConfigForm(props);
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
  />
</template>
