<script setup lang="ts">
import { ref } from "vue";
import { userLoginLog } from "./utils/hook";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Delete from "@iconify-icons/ep/delete";
import Search from "@iconify-icons/ep/search";
import Refresh from "@iconify-icons/ep/refresh";
import { hasAuth } from "@/router/utils";

defineOptions({
  name: "UsesLoginLog"
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
  choicesDict,
  manySelectCount,
  onSelectionCancel,
  onSearch,
  resetForm,
  handleDelete,
  handleManyDelete,
  handleSizeChange,
  handleCurrentChange,
  handleSelectionChange
} = userLoginLog(tableRef);
</script>

<template>
  <div v-if="hasAuth('list:systemLoginLog')" class="main">
    <el-form
      ref="formRef"
      :inline="true"
      :model="form"
      class="search-form bg-bg_color w-[99/100] pl-8 pt-[12px]"
    >
      <el-form-item :label="t('logsLogin.userId')" prop="creator_id">
        <el-input
          v-model="form.creator_id"
          :placeholder="t('user.verifyUserId')"
          clearable
          class="!w-[200px]"
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item :label="t('logsLogin.address')" prop="ipaddress">
        <el-input
          v-model="form.ipaddress"
          :placeholder="t('logsLogin.verifyAddress')"
          clearable
          class="!w-[200px]"
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item :label="t('logsLogin.system')" prop="system">
        <el-input
          v-model="form.system"
          :placeholder="t('logsLogin.verifySystem')"
          clearable
          class="!w-[180px]"
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item :label="t('logsLogin.browser')" prop="browser">
        <el-input
          v-model="form.browser"
          :placeholder="t('logsLogin.verifyBrowser')"
          clearable
          class="!w-[180px]"
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item :label="t('logsLogin.agent')" prop="agent">
        <el-input
          v-model="form.agent"
          :placeholder="t('logsLogin.verifyAgent')"
          clearable
          class="!w-[180px]"
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item :label="t('logsLogin.loginDisplay')" prop="login_type">
        <el-select
          v-model="form.login_type"
          class="!w-[180px]"
          clearable
          @change="onSearch"
        >
          <el-option
            v-for="item in choicesDict"
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
          :icon="useRenderIcon(Search)"
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
      :title="t('menus.hsLoginLog')"
      :columns="columns"
      @refresh="onSearch(true)"
    >
      <template #buttons>
        <el-space wrap>
          <div v-if="manySelectCount > 0" class="w-[360px]">
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
              v-if="hasAuth('manyDelete:systemLoginLog')"
              :title="
                t('buttons.hsbatchdeleteconfirm', { count: manySelectCount })
              "
              @confirm="handleManyDelete"
            >
              <template #reference>
                <el-button type="danger" plain :icon="useRenderIcon(Delete)">
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
            <el-popconfirm
              v-if="hasAuth('delete:systemLoginLog')"
              :title="t('buttons.hsconfirmdelete')"
              @confirm="handleDelete(row)"
            >
              <template #reference>
                <el-button
                  class="reset-margin"
                  link
                  type="primary"
                  :size="size"
                  :icon="useRenderIcon(Delete)"
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

<style scoped lang="scss">
.search-form {
  :deep(.el-form-item) {
    margin-bottom: 12px;
  }
}
</style>
