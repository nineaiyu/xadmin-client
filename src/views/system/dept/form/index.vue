<script lang="ts" setup>
import { ref } from "vue";
import { formRules } from "../utils/rule";
import { FormProps } from "../utils/types";
import { disableState } from "@/views/system/render";
import { useDeptForm } from "@/views/system/dept/utils/hook";

const props = withDefaults(defineProps<FormProps>(), {
  isAdd: () => true,
  treeData: () => [],
  showColumns: () => [],
  formInline: () => ({
    name: "",
    code: "",
    parent: "",
    rank: 99,
    roles: [],
    description: "",
    is_active: true,
    auto_bind: true
  })
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
    :rules="formRules"
    :hasFooter="false"
    :row-props="{ gutter: 24 }"
    label-width="120px"
  >
    <template #plus-field-parent>
      <el-cascader
        v-model="newFormInline.parent"
        :options="props.treeData"
        :disabled="disableState(props, 'parent')"
        :placeholder="t('menu.parentNode')"
        :props="{
          value: 'pk',
          label: 'name',
          emitPath: false,
          checkStrictly: true
        }"
        class="w-full"
        clearable
        filterable
      >
        <template #default="{ node, data }">
          <span>{{ data.name }}</span>
          <span v-if="!node.isLeaf"> ({{ data.children.length }}) </span>
        </template>
      </el-cascader>
    </template>
  </PlusForm>
</template>
