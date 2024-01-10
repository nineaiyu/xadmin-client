<script setup lang="ts">
import { ref } from "vue";
import { useUserNotice } from "./utils/hook";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

import Refresh from "@iconify-icons/ep/refresh";
import { hasAuth } from "@/router/utils";
import Success from "@iconify-icons/ep/success-filled";

import Eye from "@iconify-icons/ri/eye-fill";

defineOptions({
  name: "UserNotice"
});

const formRef = ref();
const tableRef = ref();
const tableBarRef = ref();
const {
  t,
  form,
  loading,
  columns,
  dataList,
  pagination,
  sortOptions,
  manySelectCount,
  levelChoices,
  unreadCount,
  noticeChoices,
  onSelectionCancel,
  onSearch,
  resetForm,
  showDialog,
  handleManyRead,
  handleReadAll,
  handleSizeChange,
  handleCurrentChange,
  handleSelectionChange
} = useUserNotice(tableRef, tableBarRef);
</script>

<template>
  <div v-if="hasAuth('list:userNotice')" class="main">
    <el-form
      ref="formRef"
      :inline="true"
      :model="form"
      class="search-form bg-bg_color w-[99/100] pl-8 pt-[12px]"
    >
      <el-form-item :label="t('labels.id')" prop="pk">
        <el-input
          v-model="form.pk"
          :placeholder="t('labels.id')"
          clearable
          class="!w-[100px]"
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item :label="t('notice.title')" prop="title">
        <el-input
          v-model="form.title"
          :placeholder="t('notice.verifyTitle')"
          clearable
          class="!w-[200px]"
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item :label="t('notice.content')" prop="message">
        <el-input
          v-model="form.message"
          :placeholder="t('notice.verifyContent')"
          clearable
          class="!w-[180px]"
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item :label="t('notice.haveRead')" prop="unread">
        <el-select
          v-model="form.unread"
          clearable
          class="!w-[160px]"
          @change="onSearch(true)"
        >
          <el-option :label="t('labels.read')" :value="false" />
          <el-option :label="t('labels.unread')" :value="true" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('notice.level')" prop="level">
        <el-select
          v-model="form.level"
          class="!w-[180px]"
          clearable
          @change="onSearch(true)"
        >
          <el-option
            v-for="item in levelChoices"
            :key="item.key"
            :label="item.label"
            :disabled="item.disabled"
            :value="item.key"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('notice.type')" prop="level">
        <el-select
          v-model="form.notice_type"
          class="!w-[180px]"
          clearable
          @change="onSearch(true)"
        >
          <el-option
            v-for="item in noticeChoices"
            :key="item.key"
            :label="item.label"
            :disabled="item.disabled"
            :value="item.key"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('labels.sort')">
        <el-select
          v-model="form.ordering"
          class="!w-[180px]"
          clearable
          @change="onSearch(true)"
        >
          <el-option
            v-for="item in sortOptions"
            :key="item.key"
            :label="item.label"
            :value="item.key"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button
          type="primary"
          :icon="useRenderIcon('search')"
          :loading="loading"
          @click="onSearch(true)"
        >
          {{ t("buttons.hssearch") }}
        </el-button>
        <el-button :icon="useRenderIcon(Refresh)" @click="resetForm(formRef)">
          {{ t("buttons.hsreload") }}
        </el-button>
      </el-form-item>
    </el-form>

    <PureTableBar
      ref="tableBarRef"
      :title="t('notice.messageManage')"
      :columns="columns"
      @refresh="onSearch(true)"
    >
      <template #buttons>
        <el-space wrap>
          <div v-if="manySelectCount > 0" class="w-[300px]">
            <span
              style="font-size: var(--el-font-size-base)"
              class="text-[rgba(42,46,54,0.5)] dark:text-[rgba(220,220,242,0.5)]"
            >
              {{ t("buttons.hsselected", { count: manySelectCount }) }}
            </span>
            <el-button type="primary" text @click="onSelectionCancel">
              {{ t("buttons.hscancel") }}
            </el-button>
            <el-popconfirm
              v-if="hasAuth('update:userNoticeRead')"
              :title="
                t('buttons.hsbatchdeleteconfirm', { count: manySelectCount })
              "
              @confirm="handleManyRead"
            >
              <template #reference>
                <el-button type="success" plain :icon="useRenderIcon(Success)">
                  {{ t("notice.batchRead") }}
                </el-button>
              </template>
            </el-popconfirm>
          </div>
          <el-button
            v-if="hasAuth('update:userNoticeReadAll') && unreadCount > 0"
            class="mr-2"
            type="primary"
            @click="handleReadAll"
          >
            {{ t("notice.allRead") }}
          </el-button>
          <el-text v-if="unreadCount > 0" type="primary">
            {{ t("notice.unreadMessage") }} {{ unreadCount }}
          </el-text>
        </el-space>
      </template>
      <template v-slot="{ size, dynamicColumns }">
        <pure-table
          ref="tableRef"
          border
          align-whole="center"
          showOverflowTooltip
          table-layout="auto"
          :loading="loading"
          :size="size"
          adaptive
          row-key="pk"
          :data="dataList"
          :columns="dynamicColumns"
          :pagination="pagination"
          :paginationSmall="size === 'small'"
          :header-cell-style="{
            background: 'var(--el-table-row-hover-bg-color)',
            color: 'var(--el-text-color-primary)'
          }"
          @selection-change="handleSelectionChange"
          @page-size-change="handleSizeChange"
          @page-current-change="handleCurrentChange"
        >
          <template #operation="{ row }">
            <el-button
              v-if="hasAuth('list:userNotice')"
              class="reset-margin"
              link
              type="primary"
              :size="size"
              :icon="useRenderIcon(Eye)"
              @click="showDialog(row)"
            >
              {{ t("buttons.hsdetail") }}
            </el-button>
          </template>
        </pure-table>
      </template>
    </PureTableBar>
  </div>
</template>

<style scoped lang="scss">
:deep(.el-dropdown-menu__item i) {
  margin: 0;
}

.search-form {
  :deep(.el-form-item) {
    margin-bottom: 12px;
  }
}
</style>
