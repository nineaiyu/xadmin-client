<script lang="ts" setup>
import { ref } from "vue";
import ReCol from "@/components/ReCol";
import { formRules } from "../utils/rule";
import { FormProps } from "../utils/types";
import { usePublicHooks } from "@/views/system/hooks";
import { useI18n } from "vue-i18n";

const props = withDefaults(defineProps<FormProps>(), {
  isAdd: () => true,
  treeData: () => [],
  showColumns: () => [],
  choicesDict: () => [],
  formInline: () => ({
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
    label-width="100px"
  >
    <el-row :gutter="30">
      <re-col :sm="24" :value="12" :xs="24">
        <el-form-item :label="t('user.username')" prop="username">
          <el-input
            v-model="newFormInline.username"
            :disabled="
              !props.isAdd && props.showColumns.indexOf('username') === -1
            "
            :placeholder="t('user.verifyUsername')"
            clearable
          />
        </el-form-item>
      </re-col>
      <re-col :sm="24" :value="12" :xs="24">
        <el-form-item :label="t('user.nickname')" prop="nickname">
          <el-input
            v-model="newFormInline.nickname"
            :disabled="
              !props.isAdd && props.showColumns.indexOf('nickname') === -1
            "
            :placeholder="t('user.verifyNickname')"
            clearable
          />
        </el-form-item>
      </re-col>
      <re-col v-if="props.isAdd" :sm="24" :value="12" :xs="24">
        <el-form-item :label="t('user.password')" prop="password">
          <el-input
            v-model="newFormInline.password"
            :placeholder="t('user.verifyPassword')"
            clearable
          />
        </el-form-item>
      </re-col>
      <re-col :sm="24" :value="12" :xs="24">
        <el-form-item :label="t('user.mobile')" prop="mobile">
          <el-input
            v-model="newFormInline.mobile"
            :disabled="
              !props.isAdd && props.showColumns.indexOf('mobile') === -1
            "
            :placeholder="t('user.verifyMobile')"
            clearable
          />
        </el-form-item>
      </re-col>

      <re-col :sm="24" :value="12" :xs="24">
        <el-form-item :label="t('user.email')" prop="email">
          <el-input
            v-model="newFormInline.email"
            :disabled="
              !props.isAdd && props.showColumns.indexOf('email') === -1
            "
            :placeholder="t('user.verifyEmail')"
            clearable
          />
        </el-form-item>
      </re-col>
      <re-col :sm="24" :value="12" :xs="24">
        <el-form-item :label="t('user.gender')" prop="gender">
          <el-select
            v-model="newFormInline.gender"
            :disabled="
              !props.isAdd && props.showColumns.indexOf('gender') === -1
            "
            class="w-full"
            clearable
          >
            <el-option
              v-for="item in props.choicesDict"
              :key="item.key"
              :disabled="item.disabled"
              :label="item.label"
              :value="item.key"
            />
          </el-select>
        </el-form-item>
      </re-col>
      <re-col :sm="24" :value="12" :xs="24">
        <el-form-item :label="t('labels.status')" prop="is_active">
          <el-switch
            v-model="newFormInline.is_active"
            :active-text="t('labels.active')"
            :active-value="true"
            :disabled="
              !props.isAdd && props.showColumns.indexOf('is_active') === -1
            "
            :inactive-text="t('labels.inactive')"
            :inactive-value="false"
            :style="switchStyle"
            inline-prompt
          />
        </el-form-item>
      </re-col>
      <re-col :sm="24" :value="24" :xs="24">
        <el-form-item :label="t('user.dept')" prop="dept">
          <el-cascader
            v-model="newFormInline.dept"
            :disabled="!props.isAdd && props.showColumns.indexOf('dept') === -1"
            :options="props.treeData"
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
        </el-form-item>
      </re-col>
      <re-col>
        <el-form-item :label="t('labels.description')">
          <el-input
            v-model="newFormInline.description"
            :disabled="
              !props.isAdd && props.showColumns.indexOf('description') === -1
            "
            :placeholder="t('labels.verifyDescription')"
            rows="3"
            type="textarea"
          />
        </el-form-item>
      </re-col>
    </el-row>
  </el-form>
</template>
