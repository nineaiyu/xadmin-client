<script setup lang="ts">
import { ref } from "vue";
import ReCol from "@/components/ReCol";
import { formRules } from "../utils/rule";
import { FormProps } from "../utils/types";
import { usePublicHooks } from "@/views/system/hooks";
import { useI18n } from "vue-i18n";

const props = withDefaults(defineProps<FormProps>(), {
  treeData: () => [],
  choicesDict: () => [],
  formInline: () => ({
    is_add: true,
    username: "",
    nickname: "",
    avatar: "",
    mobile: "",
    email: "",
    dept: "",
    gender: 0,
    roles: [],
    password: "",
    is_active: true
  })
});
const { t } = useI18n();

const ruleFormRef = ref();
const { switchStyle } = usePublicHooks();
const newFormInline = ref(props.formInline);

function getRef() {
  return ruleFormRef.value;
}

defineExpose({ getRef });
</script>

<template>
  <el-form
    ref="ruleFormRef"
    :model="newFormInline"
    :rules="formRules"
    label-width="82px"
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
      <re-col v-if="newFormInline.is_add" :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('user.password')" prop="password">
          <el-input
            v-model="newFormInline.password"
            clearable
            :placeholder="t('user.verifyPassword')"
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
        <el-form-item :label="t('user.gender')" prop="gender">
          <el-select v-model="newFormInline.gender" class="w-full" clearable>
            <el-option
              v-for="item in props.choicesDict"
              :key="item.key"
              :label="item.label"
              :value="item.key"
              :disabled="item.disabled"
            />
          </el-select>
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('labels.status')" prop="is_active">
          <el-switch
            v-model="newFormInline.is_active"
            inline-prompt
            :active-value="true"
            :inactive-value="false"
            :active-text="t('labels.active')"
            :inactive-text="t('labels.inactive')"
            :style="switchStyle"
          />
        </el-form-item>
      </re-col>
      <re-col :value="24" :xs="24" :sm="24">
        <el-form-item :label="t('user.dept')" prop="parent">
          <el-cascader
            v-model="newFormInline.dept"
            class="w-full"
            :options="props.treeData"
            :props="{
              value: 'pk',
              label: 'name',
              emitPath: false,
              checkStrictly: true
            }"
            clearable
            filterable
            :placeholder="t('menu.parentNode')"
          >
            <template #default="{ node, data }">
              <span>{{ data.name }}</span>
              <span v-if="!node.isLeaf"> ({{ data.children.length }}) </span>
            </template>
          </el-cascader>
        </el-form-item>
      </re-col>
      <re-col>
        <el-form-item :label="t('labels.description')">
          <el-input
            v-model="newFormInline.description"
            :placeholder="t('labels.verifyDescription')"
            type="textarea"
            rows="3"
          />
        </el-form-item>
      </re-col>
    </el-row>
  </el-form>
</template>
