<script lang="ts" setup>
import { ref } from "vue";
import { RoleFormProps } from "../utils/types";
import { ModeChoices } from "@/views/system/constants";
import { useSystemUserRoleForm } from "../utils/hook";

const props = withDefaults(defineProps<RoleFormProps>(), {
  formInline: () => ({
    username: "",
    nickname: "",
    mode_type: ModeChoices.AND,
    rules: [],
    roles: []
  }),
  rolesOptions: () => [],
  modeChoices: () => [],
  rulesOptions: () => []
});
const formRef = ref();
const { columns } = useSystemUserRoleForm(props);
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
