<script setup lang="ts">
import { ref } from "vue";
import ReCol from "@/components/ReCol";
import { FormProps } from "./utils/types";
import { useI18n } from "vue-i18n";
import { usePublicHooks } from "@/views/system/hooks";

const props = withDefaults(defineProps<FormProps>(), {
  formInline: () => ({
    pk: "",
    owner_id: "",
    user_name: "",
    nick_name: "",
    user_id: "",
    default_drive_id: "",
    default_sbox_drive_id: "",
    avatar: "",
    expire_time: "",
    x_device_id: "",
    used_size: "",
    total_size: "",
    description: "",
    enable: "",
    private: "",
    created_time: "",
    updated_time: "",
    active: ""
  })
});
const { t } = useI18n();
const { switchStyle } = usePublicHooks();

const ruleFormRef = ref();
const newFormInline = ref(props.formInline);

function getRef() {
  return ruleFormRef.value;
}

defineExpose({ getRef });
</script>

<template>
  <el-form ref="ruleFormRef" :model="newFormInline" label-width="150px">
    <el-row :gutter="30">
      <re-col :value="24" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesDrive.userid')" prop="userid">
          <el-input
            v-model="newFormInline.user_id"
            disabled
            clearable
            :placeholder="t('MoviesDrive.verifyUserid')"
          />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesDrive.username')" prop="username">
          <el-input
            v-model="newFormInline.user_name"
            disabled
            clearable
            :placeholder="t('MoviesDrive.verifyUsername')"
          />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesDrive.driveId')" prop="driveId">
          <el-input
            v-model="newFormInline.default_drive_id"
            clearable
            disabled
            :placeholder="t('MoviesDrive.driveId')"
          />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesDrive.sboxDriveId')" prop="sboxDriveId">
          <el-input
            v-model="newFormInline.default_sbox_drive_id"
            clearable
            disabled
            :placeholder="t('MoviesDrive.sboxDriveId')"
          />
        </el-form-item>
      </re-col>

      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesDrive.totalSize')" prop="totalSize">
          <el-input
            v-model="newFormInline.total_size"
            clearable
            disabled
            :placeholder="t('MoviesDrive.totalSize')"
          />
        </el-form-item>
      </re-col>
      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('MoviesDrive.usedSize')" prop="usedSize">
          <el-input
            v-model="newFormInline.used_size"
            clearable
            disabled
            :placeholder="t('MoviesDrive.usedSize')"
          />
        </el-form-item>
      </re-col>

      <re-col :value="12" :xs="24" :sm="24">
        <el-form-item :label="t('labels.status')" prop="is_active">
          <el-switch
            v-model="newFormInline.enable"
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
        <el-form-item :label="t('MoviesDrive.deviceId')" prop="deviceId">
          <el-input
            v-model="newFormInline.x_device_id"
            clearable
            disabled
            :placeholder="t('MoviesDrive.deviceId')"
          />
        </el-form-item>
      </re-col>

      <re-col>
        <el-form-item :label="t('labels.remark')">
          <el-input
            v-model="newFormInline.description"
            :placeholder="t('labels.remark')"
            type="textarea"
            rows="3"
          />
        </el-form-item>
      </re-col>
    </el-row>
  </el-form>
</template>
