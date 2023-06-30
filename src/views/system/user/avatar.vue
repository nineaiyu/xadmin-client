<script setup lang="ts">
import { ref } from "vue";
import { formRules } from "./utils/rule";
import { FormProps } from "./utils/types";

import { hasAuth } from "@/router/utils";
import avatar from "./utils/avatar.png";
import { formatBytes } from "@pureadmin/utils";
import ReCropper from "@/components/ReCropper";

const props = withDefaults(defineProps<FormProps>(), {
  formInline: () => ({
    username: "",
    nickname: "",
    avatar: "",
    is_edit: false
  })
});
const ruleFormRef = ref();
const newFormInline = ref(props.formInline);

function getRef() {
  return ruleFormRef.value;
}

const showPopover = ref(false);
const infos = ref();
const blobData = ref();
const refCropper = ref();
const cropperImg = ref<string>("");

function onCropper({ base64, blob, info }) {
  infos.value = info;
  blobData.value = blob;
  cropperImg.value = base64;
}

function getAvatarFile() {
  return new File([blobData.value], "avatar.png", {
    type: blobData.value.type,
    lastModified: Date.now()
  });
}
function getAvatarImg() {
  return cropperImg.value;
}

defineExpose({ getRef, getAvatarFile, getAvatarImg });
</script>

<template>
  <el-form
    ref="ruleFormRef"
    :model="newFormInline"
    :rules="formRules"
    label-width="82px"
  >
    <el-form-item label="用户名" prop="username">
      <el-input
        v-model="newFormInline.username"
        clearable
        :disabled="newFormInline.is_edit"
        placeholder="请输入用户名"
      />
    </el-form-item>

    <el-form-item label="昵称" prop="nickname">
      <el-input
        v-model="newFormInline.nickname"
        clearable
        :disabled="newFormInline.is_edit"
        placeholder="请输入昵称"
      />
    </el-form-item>
    <el-form-item
      label="头像"
      prop="avatar"
      v-if="hasAuth('upload:systemAvatar')"
    >
      <div>
        <div class="w-[30%] float-left">
          <div
            v-if="infos"
            class="flex flex-wrap justify-center items-center text-center"
          >
            <el-image
              v-if="cropperImg"
              :src="cropperImg"
              :preview-src-list="Array.of(cropperImg)"
              fit="cover"
            />
            <span class="m-4">
              图像大小：{{ parseInt(infos.width) }} ×
              {{ parseInt(infos.height) }}像素
            </span>
            <span>
              文件大小：{{ formatBytes(infos.size) }}（{{ infos.size }} 字节）
            </span>
          </div>
        </div>
        <div class="w-[68%] float-right">
          <ReCropper
            ref="refCropper"
            class="w-[30vw]"
            :src="newFormInline.avatar ? newFormInline.avatar : avatar"
            circled
            @cropper="onCropper"
            @readied="showPopover = true"
          />
        </div>
      </div>
    </el-form-item>
  </el-form>
</template>
