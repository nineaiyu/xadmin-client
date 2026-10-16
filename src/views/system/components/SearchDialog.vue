<script lang="ts" setup>
import { computed, ref } from "vue";

import { PlusColumn } from "plus-pro-components";
import SearchPicker, { entityOfComponentName } from "@/components/SearchPicker";

const formRef = ref();
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

/** 通知载荷的 component 字符串（SearchUser 等）映射为搜索实体预设 */
const targetEntity = computed(() =>
  entityOfComponentName(newFormInline.value.component ?? "")
);

function getRef() {
  return formRef.value;
}

defineExpose({ getRef });
</script>

<template>
  <el-form ref="formRef" class="m-5" :model="newFormInline">
    <el-form-item>
      <SearchPicker
        v-if="targetEntity"
        :entity="targetEntity"
        :modelValue="newFormInline.data"
        @change="data => (newFormInline.data = data as Array<object>)"
      />
    </el-form-item>
  </el-form>
</template>
