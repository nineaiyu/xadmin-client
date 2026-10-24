<script lang="ts" setup>
import ReEmpty from "@/components/ReEmpty";
import { isSuccess } from "@/api/types";
import { computed, onMounted, ref } from "vue";
import NoticeList from "./components/NoticeList.vue";
import BellIcon from "~icons/lucide/bell";
import { userNoticeReadApi } from "@/api/user/notice";
import { TabItem, ListItem } from "@/layout/components/lay-notice/data";
import { openNoticeDetailDialog } from "@/views/system/notice/utils/noticeDetailDialog";
import { useRouter } from "vue-router";
import { hasAuth } from "@/router/utils";
import { useI18n } from "vue-i18n";
import { useNoticeStoreHook } from "@/store/modules/notice";
import { refreshApprovalBadge, useApprovalBadge } from "@/utils/approvalBadge";
import { refreshTaskCenter, useTaskCenter } from "@/utils/taskCenter";
import { buildBadgeSources, sumBadgeSources } from "./badgeSources";
import { openTaskCenterDrawer } from "@/components/ReTaskCenterDrawer/taskCenterDrawer";

const { t } = useI18n();

/**
 * 顶栏铃铛角标 = 未读站内信 + 待我审批数（轻量审批 + 流程实例） + 进行中的异步记录数。
 *
 * 所有计数都走轻量接口（60s 轮询 + 服务端 10s 短缓存），无对应权限码的用户
 * 不发起请求、计数恒为 0（见 utils/approvalBadge 与 utils/taskCenter）。
 * 失败记录不计入角标（会在近 30 天窗口内长期滞留，制造噪声），只在任务中心抽屉里展示。
 */
const { totalPendingCount: pendingCount } = useApprovalBadge();
const { runningCount } = useTaskCenter();
const badgeCount = computed(
  () =>
    Number(useNoticeStoreHook().noticeCount || 0) +
    Number(pendingCount.value || 0) +
    Number(runningCount.value || 0)
);

/**
 * 角标里「非站内信」那两路的拆解（待我审批 / 进行中任务）。
 *
 * 弹层只列站内信，若不明示这两路，用户点开铃铛会觉得角标数字来路不明
 * （站内信为 0 时尤其明显）。这两路的明细都在任务中心抽屉里，因此数量挂在
 * 底栏「任务中心」入口上，悬停可看到逐项拆分。
 */
const badgeSources = computed(() =>
  buildBadgeSources({
    pending: pendingCount.value,
    running: runningCount.value
  })
);
const otherBadgeCount = computed(() => sumBadgeSources(badgeSources.value));
const badgeSourcesTip = computed(() =>
  badgeSources.value
    .map(item => `${t(item.labelKey)} ${item.count}`)
    .join(" · ")
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

const canViewNotice = computed(() => hasAuth("list:UserNotice"));
const getNoticeData = () => {
  userNoticeReadApi
    .unread()
    .then(res => {
      if (isSuccess(res) && res.data) {
        useNoticeStoreHook().SET_NOTICECOUNT(res.data.total);
        notices.value = res.data.results;
        if (notices.value.length > 0) {
          activeKey.value = notices.value[0].key;
        }
      }
    })
    .catch(() => undefined)
    .finally(() => {
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

/**
 * 点击未读消息：就地弹出详情并标记已读。
 * 铃铛列表接口（unread）返回的行已含 notice_type/level/message 全量字段，
 * 与「我的通知」页的行同构，可直接复用详情弹窗（见 openNoticeDetailDialog，
 * 站内信推送点击亦走该入口），无需跳转携带 ?pk=，也就不存在刷新后 URL
 * 参数反复触发弹窗的问题。
 */
const handleItemClick = (item: ListItem) => {
  dropdownRef.value?.handleClose();
  if (item.unread) {
    userNoticeReadApi.batchRead({ pks: [item.pk] }).then(() => getNoticeData());
  }
  openNoticeDetailDialog({ ...item });
};

/** 打开任务中心聚合抽屉（审批待办 / 进行中任务 / 最近导出 / 最近导入） */
const goTaskCenter = () => {
  dropdownRef.value?.handleClose();
  openTaskCenterDrawer();
};

const handleCommand = (flag: Boolean) => {
  if (flag) {
    getNoticeData();
    // 角标另两路（待我审批 / 进行中任务）与站内信同源刷新：否则弹层里的来源
    // 拆解可能与角标数字不一致（轮询间隔内新建的待办）
    refreshApprovalBadge();
    refreshTaskCenter();
  }
};
const loading = ref(true);
onMounted(() => {
  getNoticeData();
});

const getLabel = computed(
  () => (item: { name: string; total?: number }) =>
    t(item.name) + ((item.total ?? 0) > 0 ? `(${item.total ?? 0})` : "")
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
        'navbar-action',
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
          <ReEmpty
            v-if="notices.length === 0"
            :description="t('layout.noData')"
            :image-size="60"
          />
          <span v-else>
            <template v-for="item in notices" :key="item.key">
              <el-tab-pane :label="getLabel(item)" :name="`${item.key}`">
                <el-scrollbar max-height="330px" class="notice-scroll">
                  <div class="noticeList-container">
                    <NoticeList
                      :empty-text="t('layout.noData')"
                      :list="item.list"
                      @item-click="handleItemClick"
                    />
                  </div>
                  <!-- 列表末尾留白：末条与「更多 / 任务中心」底栏不贴边 -->
                  <div class="notice-scroll__spacer" />
                </el-scrollbar>
              </el-tab-pane>
            </template>
          </span>
          <!-- 底栏常驻：无未读站内信时也要能进任务中心。
               角标里「待我审批 / 进行中任务」两路的内容都在任务中心抽屉里，
               故把该路数量直接挂在入口上（悬停可看拆分），否则站内信为 0 时
               用户点开弹层只看到「暂无结果」，无从解释角标数字。 -->
          <el-divider />
          <el-row style="height: 30px; text-align: center">
            <el-col :span="canViewNotice ? 12 : 24">
              <el-link
                v-if="canViewNotice"
                underline="never"
                @click="goUserNotice"
                >{{ t("layout.more") }}</el-link
              >
            </el-col>
            <el-col :span="12">
              <el-tooltip
                :disabled="otherBadgeCount === 0"
                :content="badgeSourcesTip"
                placement="top"
              >
                <el-badge
                  :value="otherBadgeCount"
                  :max="99"
                  :hidden="otherBadgeCount === 0"
                  type="danger"
                  :offset="[6, -2]"
                  data-testid="notice-task-badge"
                >
                  <el-link underline="never" @click="goTaskCenter">{{
                    t("taskCenter.title")
                  }}</el-link>
                </el-badge>
              </el-tooltip>
            </el-col>
          </el-row>
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
  cursor: pointer;

  /* 减少动效偏好：铃铛摇摆是纯装饰，直接跳过 */
  @media (prefers-reduced-motion: reduce) {
    &:hover .header-notice-icon svg {
      animation: none;
    }
  }

  .header-notice-icon {
    font-size: var(--font-size-lg);
  }

  /* 未读徽标：EP 默认 danger 底 + 白字对比度不足（axe serious），压暗到 dark-3 */
  :deep(.el-badge__content) {
    background-color: var(--el-color-danger-dark-3);
    border-color: var(--el-color-danger-dark-3);
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

  .notice-scroll__spacer {
    height: 8px;
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
