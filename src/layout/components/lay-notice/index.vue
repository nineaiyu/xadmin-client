<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import NoticeList from "./components/noticeList.vue";
import BellIcon from "~icons/lucide/bell";
import { userNoticeReadApi } from "@/api/user/notice";
import { TabItem } from "@/layout/components/lay-notice/data";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useUserStoreHook } from "@/store/modules/user";
import { useApprovalBadge } from "@/utils/approvalBadge";

const { t } = useI18n();

/**
 * 顶栏铃铛角标 = 未读站内信 + 待我审批数。
 *
 * 审批计数走轻量接口（60s 轮询 + 服务端 10s 短缓存），无 pendingCount 权限码的
 * 用户不发起请求、计数恒为 0（见 utils/approvalBadge）。
 */
const { pendingCount } = useApprovalBadge();
const badgeCount = computed(
  () =>
    Number(useUserStoreHook().noticeCount || 0) +
    Number(pendingCount.value || 0)
);
const notices = ref<TabItem[]>([
  {
    key: "1",
    name: "layout.notice",
    list: []
  },
  {
    key: "2",
    name: "layout.announcement",
    list: []
  }
]);
const activeKey = ref();

const getNoticeData = () => {
  userNoticeReadApi.unread().then(res => {
    if (res.code === 1000 && res.data) {
      useUserStoreHook().SET_NOTICECOUNT(res.data.total);
      notices.value = res.data.results;
      if (notices.value.length > 0) {
        activeKey.value = notices.value[0].key;
      }
    }
    loading.value = false;
  });
};
const router = useRouter();
const dropdownRef = ref();

const goUserNotice = () => {
  router.push({
    name: "UserNotice"
  });
  dropdownRef.value?.handleClose();
};

const handleCommand = (flag: Boolean) => {
  if (flag) {
    getNoticeData();
  }
};
const loading = ref(true);
onMounted(() => {
  getNoticeData();
});

const getLabel = computed(
  () => item => t(item.name) + (item.total > 0 ? `(${item.total})` : "")
);
</script>

<template>
  <el-dropdown
    ref="dropdownRef"
    placement="bottom-end"
    trigger="click"
    @visibleChange="handleCommand"
  >
    <span
      :class="[
        'dropdown-badge',
        'navbar-bg-hover',
        'select-none',
        badgeCount !== 0 && 'mr-2.5'
      ]"
      role="button"
      :aria-label="t('layout.notice')"
    >
      <el-badge :max="99" :value="badgeCount === 0 ? '' : badgeCount">
        <span class="header-notice-icon">
          <IconifyIconOffline :icon="BellIcon" />
        </span>
      </el-badge>
    </span>
    <template #dropdown>
      <el-dropdown-menu>
        <el-tabs
          v-model="activeKey"
          v-loading="loading"
          :stretch="true"
          :style="{ width: notices.length === 0 ? '200px' : '330px' }"
          class="dropdown-tabs"
        >
          <el-empty
            v-if="notices.length === 0"
            :description="t('layout.noData')"
            :image-size="60"
          />
          <span v-else>
            <template v-for="item in notices" :key="item.key">
              <el-tab-pane :label="getLabel(item)" :name="`${item.key}`">
                <el-scrollbar max-height="330px">
                  <div class="noticeList-container">
                    <NoticeList
                      :empty-text="t('layout.noData')"
                      :list="item.list"
                    />
                  </div>
                </el-scrollbar>
              </el-tab-pane>
            </template>
            <el-divider />
            <el-row style="height: 30px; text-align: center">
              <el-col :span="24">
                <el-link underline="never" @click="goUserNotice">{{
                  t("layout.more")
                }}</el-link>
              </el-col>
            </el-row>
          </span>
        </el-tabs>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<style lang="scss" scoped>
/* ”铃铛“摇晃衰减动画 */
@keyframes pure-bell-ring {
  0%,
  100% {
    transform-origin: top;
  }

  15% {
    transform: rotateZ(10deg);
  }

  30% {
    transform: rotateZ(-10deg);
  }

  45% {
    transform: rotateZ(5deg);
  }

  60% {
    transform: rotateZ(-5deg);
  }

  75% {
    transform: rotateZ(2deg);
  }
}

.dropdown-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 48px;
  cursor: pointer;

  .header-notice-icon {
    font-size: 18px;
  }

  &:hover {
    .header-notice-icon svg {
      animation: pure-bell-ring 1s both;
    }
  }
}

.dropdown-tabs {
  .noticeList-container {
    padding: 5px 10px 0;
  }

  :deep(.el-tabs__header) {
    margin: 0;
  }

  :deep(.el-tabs__nav-wrap)::after {
    height: 1px;
  }

  :deep(.el-tabs__nav-wrap) {
    padding: 0 36px;
  }

  :deep(.el-divider--horizontal) {
    margin: 8px 0;
  }
}
</style>
