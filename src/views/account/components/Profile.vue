<script lang="ts" setup>
import { ref } from "vue";
import uploadLine from "~icons/ep/upload";
import { PlusForm } from "plus-pro-components";
import { formRules } from "../utils/rule";
import { useUserProfileForm } from "../utils/hook";
import AccountPanel from "./AccountPanel.vue";
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
  <AccountPanel :title="t('account.profile')">
    <PlusForm
      ref="formRef"
      v-model="userInfo"
      :columns="columns"
      :hasFooter="false"
      :row-props="{ gutter: 24 }"
      :rules="formRules"
      label-position="top"
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
      class="profile-posts"
    >
      <span class="profile-posts__label">{{ t("userinfo.posts") }}</span>
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
  </AccountPanel>
</template>

<style lang="scss" scoped>
.profile-posts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding-top: 16px;
  margin-top: 4px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.profile-posts__label {
  font-size: 13px;
  line-height: 20px;
  color: var(--el-text-color-secondary);
}
</style>
