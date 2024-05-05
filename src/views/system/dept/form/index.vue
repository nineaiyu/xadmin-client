<script lang="ts" setup>
import { ref } from "vue";
import { formRules } from "../utils/rule";
import { FormProps } from "../utils/types";
import { useDeptForm } from "@/views/system/dept/utils/hook";

const props = withDefaults(defineProps<FormProps>(), {
  formInline: () => ({
    name: "",
    code: "",
    parent: "",
    rank: 99,
    roles: [],
    description: "",
    is_active: true,
    auto_bind: true
  }),
  isAdd: () => true,
  treeData: () => [],
  showColumns: () => []
});
const { t, columns } = useDeptForm(props);

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
  />
</template>
