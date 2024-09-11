<script lang="ts" setup>
import { ref } from "vue";
import ReCol from "@/components/ReCol";
import { formRules } from "./utils/rule";
import { FormItemProps, FormProps } from "./utils/types";
import { useI18n } from "vue-i18n";
import { useApiAuth } from "./utils/hook";

defineOptions({
  name: "EditUserInfo"
});

const props = withDefaults(defineProps<FormProps>(), {
  genderChoices: () => [],
  formInline: () => ({
    username: "",
    nickname: "",
    avatar: "",
    phone: "",
    email: "",
    gender: 0
  })
});
const { t } = useI18n();
const { auth } = useApiAuth();

const ruleFormRef = ref();
const newFormInline = ref(props.formInline);

const emit = defineEmits<{
  (e: "handleUpdate", v: FormItemProps): void;
}>();

const handleUpdate = row => {
  ruleFormRef.value.validate(valid => {
    if (valid) {
      emit("handleUpdate", row);
    }
  });
};
</script>

<template>
  <el-form
    ref="ruleFormRef"
    :disabled="!auth.update"
    :model="newFormInline"
    :rules="formRules"
    label-width="82px"
  >
    <el-row :gutter="30">
      <re-col :sm="24" :value="12" :xs="24">
        <el-form-item :label="t('userinfo.username')" prop="username">
          <el-input
            v-model="newFormInline.username"
            :placeholder="t('userinfo.username')"
            clearable
          />
        </el-form-item>
      </re-col>
      <re-col :sm="24" :value="12" :xs="24">
        <el-form-item :label="t('userinfo.nickname')" prop="nickname">
          <el-input
            v-model="newFormInline.nickname"
            :placeholder="t('userinfo.nickname')"
            clearable
          />
        </el-form-item>
      </re-col>
      <re-col :sm="24" :value="12" :xs="24">
        <el-form-item :label="t('userinfo.phone')" prop="phone">
          <el-input
            v-model="newFormInline.phone"
            :placeholder="t('userinfo.phone')"
            clearable
          />
        </el-form-item>
      </re-col>
      <re-col :sm="24" :value="12" :xs="24">
        <el-form-item :label="t('userinfo.email')" prop="email">
          <el-input
            v-model="newFormInline.email"
            :placeholder="t('userinfo.email')"
            clearable
          />
        </el-form-item>
      </re-col>
      <re-col :sm="24" :value="12" :xs="24">
        <el-form-item :label="t('userinfo.gender')" prop="gender">
          <el-select
            v-model="newFormInline.gender"
            :placeholder="t('userinfo.gender')"
            class="w-full"
            clearable
          >
            <el-option
              v-for="item in props.genderChoices"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </re-col>
    </el-row>
    <el-form-item>
      <el-popconfirm
        v-if="auth.update"
        :title="t('buttons.confirmUpdate')"
        @confirm="handleUpdate(newFormInline)"
      >
        <template #reference>
          <el-button>{{ t("buttons.save") }}</el-button>
        </template>
      </el-popconfirm>
    </el-form-item>
  </el-form>
</template>
