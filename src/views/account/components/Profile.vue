<script lang="ts" setup>
import { ref } from "vue";
import { deviceDetection } from "@pureadmin/utils";
import uploadLine from "~icons/ep/upload";
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
  <div :class="['min-w-45', deviceDetection() ? 'max-w-full' : 'max-w-[70%]']">
    <h3 class="my-8!">{{ t("account.profile") }}</h3>
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
        <el-button
          v-if="auth.upload"
          class="ml-4!"
          plain
          @click="handleUpload(userInfo)"
        >
          <IconifyIconOffline :icon="uploadLine" />
          <span class="ml-2">{{ t("userinfo.updateAvatar") }}</span>
        </el-button>
      </template>
      <template #plus-field-operation>
        <div class="mt-3">
          <el-popconfirm
            v-if="auth.partialUpdate"
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
    <!-- 岗位为人员维度只读回显（不参与权限判定），由服务端 userinfo 下发 -->
    <div
      v-if="(userInfo.posts as string[] | undefined)?.length"
      class="mt-3 flex flex-wrap items-center gap-2"
    >
      <span class="text-sm text-(--el-text-color-regular)">
        {{ t("userinfo.posts") }}
      </span>
      <el-tag
        v-for="post in userInfo.posts"
        :key="post"
        size="small"
        type="primary"
        effect="plain"
      >
        {{ post }}
      </el-tag>
    </div>
  </div>
</template>
