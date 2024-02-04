<script lang="ts" setup>
import { ref } from "vue";
import { useUserInfo } from "./utils/hook";
import editUserInfo from "./edit.vue";
import editUserPassword from "./password.vue";
import editUserAvatar from "./avatar.vue";
import { hasAuth } from "@/router/utils";
import dayjs from "dayjs";

defineOptions({
  name: "UserInfo"
});

const {
  currentUserInfo,
  choicesDict,
  handleUpdate,
  handleUpload,
  handleResetPassword,
  t
} = useUserInfo();
const activeTab = ref("userinfo");
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
              class="h-[120px]"
              fit="cover"
            />
          </div>

          <el-descriptions :column="1" size="large">
            <el-descriptions-item :label="t('user.username')"
              >{{ currentUserInfo.username }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('user.nickname')"
              >{{ currentUserInfo.nickname }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('user.mobile')"
              >{{ currentUserInfo.mobile }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('user.email')"
              >{{ currentUserInfo.email }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('user.gender')">
              <el-tag type="success">
                {{ currentUserInfo.gender_display }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item
              v-if="
                currentUserInfo?.dept_info && currentUserInfo?.dept_info?.name
              "
              :label="t('user.dept')"
            >
              <el-tag type="success">
                {{ currentUserInfo.dept_info.name }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item
              v-if="
                currentUserInfo.roles_info && currentUserInfo.roles_info.length
              "
              :label="t('user.roles')"
            >
              <el-space>
                <el-tag
                  v-for="item in currentUserInfo.roles_info"
                  :key="item.pk"
                  >{{ item.name }}
                </el-tag>
              </el-space>
            </el-descriptions-item>
            <el-descriptions-item :label="t('sorts.registrationDate')">
              {{
                dayjs(currentUserInfo.date_joined).format("YYYY-MM-DD HH:mm:ss")
              }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('sorts.loginDate')">
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
              :choices-dict="choicesDict"
              :form-inline="currentUserInfo"
              @handle-update="handleUpdate"
            />
          </el-tab-pane>
          <el-tab-pane
            v-if="hasAuth('update:UserInfoPassword')"
            :label="t('userinfo.changePassword')"
            name="resetPwd"
          >
            <edit-user-password @handle-update="handleResetPassword" />
          </el-tab-pane>
          <el-tab-pane
            v-if="hasAuth('upload:UserInfoAvatar')"
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

.search-form {
  :deep(.el-form-item) {
    margin-bottom: 12px;
  }
}

.main-content {
  margin: 20px 20px 0 !important;
}
</style>
