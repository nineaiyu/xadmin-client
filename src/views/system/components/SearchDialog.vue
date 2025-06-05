<script lang="ts" setup>
import { ref } from "vue";

import { PlusColumn } from "plus-pro-components";

const formRef = ref();
import SearchUser from "@/views/system/components/SearchUser.vue";
import SearchDept from "@/views/system/components/SearchDept.vue";
import SearchRole from "@/views/system/components/SearchRole.vue";
defineOptions({ name: "SearchDialog" });

interface FormItemProps {
  data: Array<object>;
  component?: string;
}

interface FormProps {
  formInline?: FormItemProps;
  formProps?: object;
  columns?: PlusColumn[];
  allowTypes?: string[];
}

const props = withDefaults(defineProps<FormProps>(), {
  formInline: () => ({
    component: "SearchUser",
    data: []
  })
});

const newFormInline = ref<FormItemProps>(props.formInline);

function getRef() {
  return formRef.value;
}

defineExpose({ getRef });
</script>

<template>
  <el-form ref="formRef" class="m-5" :model="newFormInline">
    <el-form-item>
      <SearchUser
        v-if="newFormInline.component === 'SearchUser'"
        :modelValue="newFormInline.data"
        @change="data => (newFormInline.data = data)"
      />
      <SearchDept
        v-if="newFormInline.component === 'SearchDept'"
        :modelValue="newFormInline.data"
        @change="data => (newFormInline.data = data)"
      />
      <SearchRole
        v-if="newFormInline.component === 'SearchRole'"
        :modelValue="newFormInline.data"
        @change="data => (newFormInline.data = data)"
      />
    </el-form-item>
  </el-form>
</template>
