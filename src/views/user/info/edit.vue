<script setup lang="ts">
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
  formInline: () => ({
    username: "",
    nickname: "",
    avatar: "",
    mobile: "",
    email: "",
    sex: 0
  })
});
const { t } = useI18n();

const sexOptions = [
  { label: t("user.male"), value: 0 },
  { label: t("user.female"), value: 1 },
  { label: t("user.unknown"), value: 2 }
];
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
    :model="newFormInline"
    :rules="formRules"
    label-width="82px"
    :disabled="!hasAuth('update:UserInfo')"
  >
    <el-row :gutter="30">
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('user.username')" prop="username">
          <el-input
            v-model="newFormInline.username"
            clearable
            :placeholder="t('user.verifyUsername')"
          />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('user.nickname')" prop="nickname">
          <el-input
            v-model="newFormInline.nickname"
            clearable
            :placeholder="t('user.verifyNickname')"
          />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('user.mobile')" prop="mobile">
          <el-input
            v-model="newFormInline.mobile"
            clearable
            :placeholder="t('user.verifyMobile')"
          />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('user.email')" prop="email">
          <el-input
            v-model="newFormInline.email"
            clearable
            :placeholder="t('user.verifyEmail')"
          />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('user.gender')" prop="sex">
          <el-select
            v-model="newFormInline.sex"
            :placeholder="t('user.verifySex')"
            class="w-full"
            clearable
          >
            <el-option
              v-for="item in sexOptions"
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
        :title="t('buttons.hsconfirmdupdate')"
        @confirm="handleUpdate(newFormInline)"
        v-if="hasAuth('update:UserInfo')"
      >
        <template #reference>
          <el-button>{{ t("buttons.hssave") }}</el-button>
        </template>
      </el-popconfirm>
    </el-form-item>
  </el-form>
</template>
