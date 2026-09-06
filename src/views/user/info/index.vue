<script lang="ts" setup>
import dayjs from "dayjs";
import { computed, ref } from "vue";
import type { ChoicesLabel } from "./utils/types";
import editUserInfo from "./components/edit.vue";
import editUserAvatar from "./components/avatar.vue";
import editUserMfa from "./components/mfa.vue";
import { useUserInfo } from "./utils/hook";
import editUserPassword from "./components/password.vue";

defineOptions({
  name: "UserInfo"
});

const {
  auth,
  genderChoices,
  currentUserInfo,
  handleUpdate,
  handleUpload,
  handleResetPassword,
  t
} = useUserInfo();
const activeTab = ref("userinfo");
/** gender 在 choices 下发后为选项对象；数字形态（未下发）时无 label/value */
const genderInfo = computed<ChoicesLabel | undefined>(() =>
  typeof currentUserInfo.gender === "object"
    ? currentUserInfo.gender
    : undefined
);
</script>

<template>
  <el-row :gutter="24">
    <el-col :lg="8" :md="8" :sm="24" :xl="8" :xs="24">
      <el-card>
        <template v-slot:header>
          <div class="clearfix">
            <span>{{ t("userinfo.userinfo") }}</span>
          </div>
        </template>
        <div>
          <div class="text-center">
            <el-image
              :preview-src-list="Array.of(currentUserInfo.avatar)"
              :src="currentUserInfo.avatar"
              class="h-30"
              fit="cover"
            />
          </div>

          <el-descriptions :column="1" size="large">
            <el-descriptions-item :label="t('userinfo.username')"
              >{{ currentUserInfo.username }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('userinfo.nickname')"
              >{{ currentUserInfo.nickname }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('userinfo.phone')"
              >{{ currentUserInfo.phone }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('userinfo.email')"
              >{{ currentUserInfo.email }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('userinfo.gender')">
              <el-tag :type="genderInfo?.value === 2 ? 'danger' : 'primary'">
                {{ genderInfo?.label }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item
              v-if="currentUserInfo?.dept && currentUserInfo?.dept?.name"
              :label="t('userinfo.dept')"
            >
              <el-tag type="success">
                {{ currentUserInfo.dept.name }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item
              v-if="currentUserInfo.roles && currentUserInfo.roles.length"
              :label="t('userinfo.roles')"
            >
              <el-space>
                <el-tag v-for="item in currentUserInfo.roles" :key="item.pk"
                  >{{ item.name }}
                </el-tag>
              </el-space>
            </el-descriptions-item>
            <el-descriptions-item :label="t('userinfo.date_joined')">
              {{
                dayjs(currentUserInfo.date_joined).format("YYYY-MM-DD HH:mm:ss")
              }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('userinfo.last_login')">
              {{
                dayjs(currentUserInfo.last_login).format("YYYY-MM-DD HH:mm:ss")
              }}
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </el-card>
    </el-col>
    <el-col :lg="16" :md="16" :sm="24" :xl="16" :xs="24">
      <el-card>
        <template v-slot:header>
          <div class="clearfix">
            <span>{{ t("userinfo.updateUserInfo") }}</span>
          </div>
        </template>
        <el-tabs v-model="activeTab">
          <el-tab-pane :label="t('userinfo.basicInfo')" name="userinfo">
            <edit-user-info
              :form-inline="currentUserInfo"
              :gender-choices="genderChoices"
              @handle-partialUpdate="handleUpdate"
            />
          </el-tab-pane>
          <el-tab-pane
            v-if="auth.resetPassword"
            :label="t('userinfo.changePassword')"
            name="resetPwd"
          >
            <edit-user-password @handle-update="handleResetPassword" />
          </el-tab-pane>
          <el-tab-pane :label="t('mfa.tabTitle')" name="mfa">
            <edit-user-mfa v-if="activeTab === 'mfa'" />
          </el-tab-pane>
          <el-tab-pane
            v-if="auth.upload"
            :label="t('userinfo.updateAvatar')"
            name="avatar"
          >
            <edit-user-avatar
              v-if="activeTab === 'avatar'"
              :avatar="currentUserInfo.avatar"
              @handle-update="handleUpload"
            />
          </el-tab-pane>
        </el-tabs>
      </el-card>
    </el-col>
  </el-row>
</template>

<style lang="scss" scoped>
:deep(.el-button:focus-visible) {
  outline: none;
}

.main-content {
  margin: 20px 20px 0 !important;
}
</style>
