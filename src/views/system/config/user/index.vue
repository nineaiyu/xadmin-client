<script lang="ts" setup>
import { ref } from "vue";
import { useUserConfig } from "./utils/hook";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

import Delete from "@iconify-icons/ep/delete";
import EditPen from "@iconify-icons/ep/edit-pen";

import Refresh from "@iconify-icons/ep/refresh";
import AddFill from "@iconify-icons/ri/add-circle-line";
import CircleClose from "@iconify-icons/ep/circle-close";
import { hasAuth } from "@/router/utils";

defineOptions({
  name: "SystemUserConfig"
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
  openDialog,
  handleDelete,
  handleManyDelete,
  handleSizeChange,
  handleInvalidCache,
  handleCurrentChange,
  handleSelectionChange
} = useUserConfig(tableRef);
</script>

<template>
  <div v-if="hasAuth('list:systemUserConfig')" class="main">
    <el-form
      ref="formRef"
      :inline="true"
      :model="form"
      class="search-form bg-bg_color w-[99/100] pl-8 pt-[12px] overflow-auto"
    >
      <el-form-item :label="t('user.username')" prop="username">
        <el-input
          v-model="form.username"
          :placeholder="t('user.verifyUsername')"
          class="!w-[180px]"
          clearable
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item :label="t('configUser.key')" prop="key">
        <el-input
          v-model="form.key"
          :placeholder="t('configUser.key')"
          class="!w-[200px]"
          clearable
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item :label="t('configUser.value')" prop="value">
        <el-input
          v-model="form.value"
          :placeholder="t('configUser.value')"
          class="!w-[180px]"
          clearable
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item :label="t('labels.description')" prop="description">
        <el-input
          v-model="form.description"
          :placeholder="t('labels.description')"
          class="!w-[180px]"
          clearable
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item :label="t('labels.status')" prop="is_active">
        <el-select
          v-model="form.is_active"
          class="!w-[180px]"
          clearable
          @change="onSearch(true)"
        >
          <el-option :label="t('labels.enable')" value="1" />
          <el-option :label="t('labels.disable')" value="0" />
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
      :title="t('menus.hsUserConfig')"
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
              v-if="hasAuth('manyDelete:systemUserConfig')"
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

          <el-button
            v-if="hasAuth('create:systemUserConfig')"
            :icon="useRenderIcon(AddFill)"
            type="primary"
            @click="openDialog()"
          >
            {{ t("buttons.hsadd") }}
          </el-button>
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
              v-if="hasAuth('update:systemUserConfig')"
              :icon="useRenderIcon(EditPen)"
              :size="size"
              class="reset-margin"
              link
              type="primary"
              @click="openDialog(false, row)"
            >
              {{ t("buttons.hsedit") }}
            </el-button>
            <el-popconfirm
              v-if="hasAuth('invalid:systemUserConfig')"
              :title="t('configUser.confirmInvalid')"
              @confirm="handleInvalidCache(row)"
            >
              <template #reference>
                <el-button
                  :icon="useRenderIcon(CircleClose)"
                  :size="size"
                  class="reset-margin"
                  link
                  type="primary"
                >
                  {{ t("configUser.invalidCache") }}
                </el-button>
              </template>
            </el-popconfirm>
            <el-popconfirm
              v-if="hasAuth('delete:systemUserConfig')"
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
