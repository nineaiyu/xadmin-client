<script lang="ts" setup>
import { ref } from "vue";
import ReSendVerifyCode from "@/components/ReSendVerifyCode";
import {
  FieldValues,
  type PlusColumn,
  PlusDescriptions
} from "plus-pro-components";
import { useI18n } from "vue-i18n";

defineOptions({
  name: "BindEmailOrPhone"
});

const { t } = useI18n();

const verifyCodeRef = ref();
function getRef() {
  return verifyCodeRef.value?.getRef();
}

defineExpose({ getRef });

interface AddOrEditFormProps {
  formInline?: FieldValues;
  formProps?: object;
  columns?: PlusColumn[];
  category: string;
}

const props = withDefaults(defineProps<AddOrEditFormProps>(), {
  formInline: () => ({}),
  formProps: () => ({}),
  columns: () => [],
  category: ""
});

const formData = ref(props.formInline);

const data = ref({
  username: ""
});

const sendCodeReqSuccess = ({ extra }) => {
  if (extra?.username) {
    data.value = Object.assign({}, extra);
  }
};
</script>
<template>
  <div class="mb-5">
    <ReSendVerifyCode
      ref="verifyCodeRef"
      v-model="formData"
      :category="category"
      @sendCodeReqSuccess="sendCodeReqSuccess"
    />
    <div v-if="data.username">
      <el-divider />
      <plus-descriptions
        class="mix-w-[500px]"
        :columns="columns"
        :data="data"
        :column="1"
      >
        <template #title>
          <div class="mb-2">
            <el-text type="danger" size="large">{{
              t("userinfo.existInfo")
            }}</el-text>
          </div>
          <el-text type="warning" size="default"
            >{{ t("userinfo.continueBind")
            }}<el-text type="danger" size="large">{{
              t("userinfo.unbind")
            }}</el-text
            >{{ t("userinfo.username")
            }}<el-text type="success" size="large">{{ data.username }}</el-text
            >{{ t("userinfo.bindInfo") }}</el-text
          >
        </template>
      </plus-descriptions>
    </div>
  </div>
</template>
