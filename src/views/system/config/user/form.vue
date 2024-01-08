<script lang="ts" setup>
import { ref } from "vue";
import { formRules } from "./utils/rule";
import { FormProps } from "./utils/types";
import { useI18n } from "vue-i18n";
import { hasGlobalAuth } from "@/router/utils";
import SearchUsers from "@/views/system/base/searchUsers.vue";

const props = withDefaults(defineProps<FormProps>(), {
  formInline: () => ({
    key: "",
    value: "",
    owner: "",
    is_add: false,
    description: "",
    config_user: [],
    is_active: true
  })
});

const { t } = useI18n();
const ruleFormRef = ref();
const newFormInline = ref(props.formInline);

function getRef() {
  return ruleFormRef.value;
}

const ifEnableOptions = [
  { label: t("labels.enable"), value: true },
  { label: t("labels.disable"), value: false }
];

defineExpose({ getRef });
</script>

<template>
  <el-form
    ref="ruleFormRef"
    :model="newFormInline"
    :rules="formRules"
    label-width="82px"
  >
    <el-form-item
      v-if="hasGlobalAuth('list:systemUser')"
      :label="t('user.userId')"
      prop="notice_user"
    >
      <search-users
        v-model="newFormInline.config_user"
        :disabled="!newFormInline.is_add"
      />
    </el-form-item>

    <el-form-item :label="t('configUser.key')" prop="key">
      <el-input
        v-model="newFormInline.key"
        :placeholder="t('configUser.key')"
        clearable
      />
    </el-form-item>

    <el-form-item :label="t('configUser.value')" prop="value">
      <el-input
        v-model="newFormInline.value"
        :autosize="{ minRows: 5, maxRows: 20 }"
        :placeholder="t('configUser.value')"
        clearable
        type="textarea"
      />
    </el-form-item>
    <el-form-item :label="t('labels.status')" prop="is_active">
      <el-radio-group v-model="newFormInline.is_active">
        <el-radio-button
          v-for="item in ifEnableOptions"
          :key="item.label"
          :label="item.value"
          >{{ item.label }}
        </el-radio-button>
      </el-radio-group>
    </el-form-item>
    <el-form-item :label="t('labels.description')">
      <el-input
        v-model="newFormInline.description"
        :placeholder="t('labels.description')"
        type="textarea"
      />
    </el-form-item>
  </el-form>
</template>
