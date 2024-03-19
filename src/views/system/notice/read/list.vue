<script lang="ts" setup>
import { ref } from "vue";
import { useNoticeRead } from "./hook";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

import Delete from "@iconify-icons/ep/delete";

import Refresh from "@iconify-icons/ep/refresh";
import { hasAuth } from "@/router/utils";
import Eye from "@iconify-icons/ri/eye-fill";

defineOptions({
  name: "SystemNoticeRead"
});

const formRef = ref();
const tableRef = ref();

const {
  t,
  form,
  loading,
  columns,
  dataList,
  pagination,
  sortOptions,
  manySelectCount,
  onSelectionCancel,
  onSearch,
  resetForm,
  noticeChoices,
  levelChoices,
  showDialog,
  handleDelete,
  handleManyDelete,
  handleSizeChange,
  handleCurrentChange,
  handleSelectionChange
} = useNoticeRead(tableRef);
</script>

<template>
  <div v-if="hasAuth('list:systemNoticeRead')" class="main">
    <el-form
      ref="formRef"
      :inline="true"
      :model="form"
      class="search-form bg-bg_color w-[99/100] pl-8 pt-[12px] overflow-auto"
    >
      <el-form-item :label="t('user.userId')" prop="message">
        <el-input
          v-model="form.owner_id"
          :placeholder="t('user.verifyUserId')"
          class="!w-[120px]"
          clearable
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item :label="t('labels.id')" prop="message">
        <el-input
          v-model="form.notice_id"
          class="!w-[120px]"
          clearable
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item :label="t('notice.title')" prop="title">
        <el-input
          v-model="form.title"
          :placeholder="t('notice.verifyTitle')"
          class="!w-[200px]"
          clearable
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item :label="t('notice.content')" prop="message">
        <el-input
          v-model="form.message"
          :placeholder="t('notice.verifyContent')"
          class="!w-[180px]"
          clearable
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>

      <el-form-item :label="t('user.username')" prop="message">
        <el-input
          v-model="form.username"
          :placeholder="t('user.verifyUsername')"
          class="!w-[180px]"
          clearable
          @keyup.enter="onSearch(true)"
        />
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
            :disabled="item.disabled"
            :label="item.label"
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
            :disabled="item.disabled"
            :label="item.label"
            :value="item.key"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('notice.haveRead')" prop="unread">
        <el-select
          v-model="form.unread"
          class="!w-[160px]"
          clearable
          @change="onSearch(true)"
        >
          <el-option :label="t('labels.read')" :value="false" />
          <el-option :label="t('labels.unread')" :value="true" />
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
          :icon="useRenderIcon('ri:search-line')"
          :loading="loading"
          type="primary"
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
      :columns="columns"
      :title="t('notice.readManage')"
      @refresh="onSearch(true)"
    >
      <template #buttons>
        <el-space wrap>
          <div v-if="manySelectCount > 0" v-motion-fade class="w-[360px]">
            <span
              class="text-[rgba(42,46,54,0.5)] dark:text-[rgba(220,220,242,0.5)]"
              style="font-size: var(--el-font-size-base)"
            >
              {{ t("buttons.hsselected", { count: manySelectCount }) }}
            </span>
            <el-button text type="primary" @click="onSelectionCancel">
              {{ t("buttons.hscancel") }}
            </el-button>
            <el-popconfirm
              v-if="hasAuth('manyDelete:systemNoticeRead')"
              :title="
                t('buttons.hsbatchdeleteconfirm', { count: manySelectCount })
              "
              @confirm="handleManyDelete"
            >
              <template #reference>
                <el-button :icon="useRenderIcon(Delete)" plain type="danger">
                  {{ t("buttons.hsbatchdelete") }}
                </el-button>
              </template>
            </el-popconfirm>
          </div>
        </el-space>
      </template>
      <template v-slot="{ size, dynamicColumns }">
        <pure-table
          ref="tableRef"
          :adaptiveConfig="{ offsetBottom: 108 }"
          :columns="dynamicColumns"
          :data="dataList"
          :header-cell-style="{
            background: 'var(--el-table-row-hover-bg-color)',
            color: 'var(--el-text-color-primary)'
          }"
          :loading="loading"
          :pagination="pagination"
          :paginationSmall="size === 'small'"
          :size="size"
          adaptive
          align-whole="center"
          row-key="pk"
          showOverflowTooltip
          table-layout="auto"
          @selection-change="handleSelectionChange"
          @page-size-change="handleSizeChange"
          @page-current-change="handleCurrentChange"
        >
          <template #operation="{ row }">
            <el-button
              v-if="hasAuth('list:systemNoticeRead')"
              :icon="useRenderIcon(Eye)"
              :size="size"
              class="reset-margin"
              link
              type="primary"
              @click="showDialog(row.notice_info)"
            >
              {{ t("buttons.hsdetail") }}
            </el-button>
            <el-popconfirm
              v-if="hasAuth('delete:systemNoticeRead')"
              :title="t('buttons.hsconfirmdelete')"
              @confirm="handleDelete(row)"
            >
              <template #reference>
                <el-button
                  :icon="useRenderIcon(Delete)"
                  :size="size"
                  class="reset-margin"
                  link
                  type="danger"
                >
                  {{ t("buttons.hsdelete") }}
                </el-button>
              </template>
            </el-popconfirm>
          </template>
        </pure-table>
      </template>
    </PureTableBar>
  </div>
</template>

<style lang="scss" scoped>
.main-content {
  margin: 24px 24px 0 !important;
}

.search-form {
  :deep(.el-form-item) {
    margin-bottom: 12px;
  }
}
</style>
