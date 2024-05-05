<script lang="ts" setup>
import { ref } from "vue";
import { formRules } from "../utils/rule";
import { FormProps } from "../utils/types";
import { useSystemUserForm } from "../utils/hook";

const props = withDefaults(defineProps<FormProps>(), {
  formInline: () => ({
    username: "",
    nickname: "",
    avatar: "",
    mobile: "",
    email: "",
    dept: "",
    gender: 0,
    roles: [],
    password: "",
    is_active: true
  }),
  isAdd: () => true,
  treeData: () => [],
  showColumns: () => [],
  genderChoices: () => []
});
const formRef = ref();
const { columns } = useSystemUserForm(props);
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
    label-width="100px"
  />
</template>
