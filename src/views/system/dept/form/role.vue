<script lang="ts" setup>
import { ref } from "vue";
import { RoleFormProps } from "../utils/types";
import { ModeChoices } from "@/views/system/constants";
import { useRoleForm } from "../utils/hook";

const props = withDefaults(defineProps<RoleFormProps>(), {
  formInline: () => ({
    name: "",
    code: "",
    mode_type: ModeChoices.AND,
    ids: [],
    pks: []
  }),
  rolesOptions: [],
  rulesOptions: [],
  choicesDict: []
});
const { t, columns } = useRoleForm(props);

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
    label-width="120px"
  />
</template>
