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
    main_dept: "",
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
const newFormInline = ref(props.formInline);
const { t, columns } = useSystemUserForm(props, newFormInline);

function getRef() {
  return formRef.value?.formInstance;
}

formRules["main_dept"] = [
  {
    required: true,
    validator: (rule, value, callback) => {
      if (value === "" || newFormInline.value.dept.indexOf(value) === -1) {
        callback(new Error(t("systemUser.main_dept")));
      } else {
        callback();
      }
    },
    trigger: "blur"
  }
];

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
