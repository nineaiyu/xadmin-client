<script lang="ts" setup>
import { onMounted, ref } from "vue";
import NoticeList from "./noticeList.vue";
import Bell from "@iconify-icons/ep/bell";
import { getUserNoticeUnreadListApi } from "@/api/user/notice";
import { TabItem } from "@/layout/components/notice/data";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useUserStoreHook } from "@/store/modules/user";

const { t } = useI18n();
const notices = ref<TabItem[]>([
  {
    key: "1",
    name: t("layout.notice"),
    list: []
  },
  {
    key: "2",
    name: t("layout.announcement"),
    list: []
  }
]);
const activeKey = ref();

const getNoticeData = () => {
  getUserNoticeUnreadListApi().then(res => {
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

const goUserNotice = () => {
  router.push({
    name: "UserNotice"
  });
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
</script>

<template>
  <el-dropdown
    placement="bottom-end"
    trigger="click"
    @visibleChange="handleCommand"
  >
    <span class="dropdown-badge navbar-bg-hover select-none">
      <el-badge :max="99" :value="useUserStoreHook().noticeCount">
        <span class="header-notice-icon">
          <IconifyIconOffline :icon="Bell" />
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
              <el-tab-pane
                :label="`${item.name}(${item.list.length})`"
                :name="`${item.key}`"
              >
                <el-scrollbar max-height="330px">
                  <div class="noticeList-container">
                    <NoticeList :list="item.list" />
                  </div>
                </el-scrollbar>
              </el-tab-pane>
            </template>
            <el-divider />
            <el-row style="height: 30px; text-align: center">
              <el-col :span="24">
                <el-link :underline="false" @click="goUserNotice">{{
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
  margin-right: 10px;
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
