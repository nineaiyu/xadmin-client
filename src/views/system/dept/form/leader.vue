<script lang="ts" setup>
import { ref } from "vue";
import { LeaderFormProps } from "../utils/types";
import { useDeptLeaderForm } from "../utils/hook";

const props = withDefaults(defineProps<LeaderFormProps>(), {
  formInline: () => ({
    name: "",
    code: "",
    leaders: []
  })
});
const { columns } = useDeptLeaderForm(props);

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
  />
</template>
