<script lang="ts" setup>
import { ref } from "vue";
import { deviceDetection } from "@pureadmin/utils";
import uploadLine from "@iconify-icons/ri/upload-line";
import { PlusForm } from "plus-pro-components";
import { formRules } from "../utils/rule";
import { useUserProfileForm } from "../utils/hook";
import avatar from "@/assets/avatar.png";

defineOptions({
  name: "Profile"
});

const formRef = ref();

const {
  t,
  auth,
  columns,
  userInfo,
  userinfoStore,
  handleUpload,
  handleUpdate
} = useUserProfileForm(formRef);
</script>

<template>
  <div
    :class="[
      'min-w-[180px]',
      deviceDetection() ? 'max-w-[100%]' : 'max-w-[70%]'
    ]"
  >
    <h3 class="my-8">{{ t("account.profile") }}</h3>
    <PlusForm
      ref="formRef"
      v-model="userInfo"
      :columns="columns"
      :hasFooter="false"
      :row-props="{ gutter: 24 }"
      :rules="formRules"
      label-position="top"
      label-width="120px"
    >
      <template #plus-field-avatar>
        <el-avatar :size="80" :src="userinfoStore.avatar ?? avatar" />
        <el-button class="ml-4" plain @click="handleUpload(userInfo)">
          <IconifyIconOffline :icon="uploadLine" />
          <span class="ml-2">{{ t("userinfo.updateAvatar") }}</span>
        </el-button>
      </template>
      <template #plus-field-operation>
        <div class="mt-3">
          <el-popconfirm
            v-if="auth.update"
            :title="t('buttons.confirmUpdate')"
            @confirm="handleUpdate(userInfo)"
          >
            <template #reference>
              <el-button>{{ t("buttons.save") }}</el-button>
            </template>
          </el-popconfirm>
        </div>
      </template>
    </PlusForm>
  </div>
</template>
