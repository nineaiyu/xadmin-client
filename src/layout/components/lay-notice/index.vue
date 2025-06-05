<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import NoticeList from "./components/noticeList.vue";
import BellIcon from "~icons/ep/bell";
import { userNoticeReadApi } from "@/api/user/notice";
import { TabItem } from "@/layout/components/lay-notice/data";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useUserStoreHook } from "@/store/modules/user";

const { t } = useI18n();
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
        useUserStoreHook().noticeCount !== 0 && 'mr-[10px]'
      ]"
    >
      <el-badge
        :max="99"
        :value="
          useUserStoreHook().noticeCount === 0
            ? ''
            : useUserStoreHook().noticeCount
        "
      >
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
