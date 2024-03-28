<script lang="ts" setup>
import { ref } from "vue";
import ReCol from "@/components/ReCol";
import { formRules } from "./utils/rule";
import { FormItemProps, FormProps } from "./utils/types";
import { hasAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";

defineOptions({
  name: "editUserInfo"
});

const props = withDefaults(defineProps<FormProps>(), {
  choicesDict: () => [],
  formInline: () => ({
    username: "",
    nickname: "",
    avatar: "",
    mobile: "",
    email: "",
    gender: 0
  })
});
const { t } = useI18n();

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
    :disabled="!hasAuth('update:UserInfo')"
    :model="newFormInline"
    :rules="formRules"
    label-width="82px"
  >
    <el-row :gutter="30">
      <re-col :sm="24" :value="12" :xs="24">
        <el-form-item :label="t('user.username')" prop="username">
          <el-input
            v-model="newFormInline.username"
            :placeholder="t('user.verifyUsername')"
            clearable
          />
        </el-form-item>
      </re-col>
      <re-col :sm="24" :value="12" :xs="24">
        <el-form-item :label="t('user.nickname')" prop="nickname">
          <el-input
            v-model="newFormInline.nickname"
            :placeholder="t('user.verifyNickname')"
            clearable
          />
        </el-form-item>
      </re-col>
      <re-col :sm="24" :value="12" :xs="24">
        <el-form-item :label="t('user.mobile')" prop="mobile">
          <el-input
            v-model="newFormInline.mobile"
            :placeholder="t('user.verifyMobile')"
            clearable
          />
        </el-form-item>
      </re-col>
      <re-col :sm="24" :value="12" :xs="24">
        <el-form-item :label="t('user.email')" prop="email">
          <el-input
            v-model="newFormInline.email"
            :placeholder="t('user.verifyEmail')"
            clearable
          />
        </el-form-item>
      </re-col>
      <re-col :sm="24" :value="12" :xs="24">
        <el-form-item :label="t('user.gender')" prop="gender">
          <el-select
            v-model="newFormInline.gender"
            :placeholder="t('user.verifyGender')"
            class="w-full"
            clearable
          >
            <el-option
              v-for="item in props.choicesDict"
              :key="item.key"
              :label="item.label"
              :value="item.key"
            />
          </el-select>
        </el-form-item>
      </re-col>
    </el-row>
    <el-form-item>
      <el-popconfirm
        v-if="hasAuth('update:UserInfo')"
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
