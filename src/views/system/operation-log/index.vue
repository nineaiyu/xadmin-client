<script setup lang="ts">
import { ref } from "vue";
import { useRole } from "./utils/hook";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

// import Database from "@iconify-icons/ri/database-2-line";
// import More from "@iconify-icons/ep/more-filled";
import Delete from "@iconify-icons/ep/delete";
import Search from "@iconify-icons/ep/search";
import Refresh from "@iconify-icons/ep/refresh";
import { hasAuth } from "@/router/utils";

defineOptions({
  name: "OperationLog"
});

const formRef = ref();
const {
  form,
  loading,
  columns,
  dataList,
  pagination,
  sortOptions,
  onSearch,
  resetForm,
  handleDelete,
  handleManyDelete,
  handleSizeChange,
  handleCurrentChange,
  handleSelectionChange
} = useRole();
</script>

<template>
  <div class="main" v-if="hasAuth('list:systemOperationLog')">
    <el-form
      ref="formRef"
      :inline="true"
      :model="form"
      class="search-form bg-bg_color w-[99/100] pl-8 pt-[12px]"
    >
      <el-form-item label="用户ID：" prop="owner_id">
        <el-input
          v-model="form.owner_id"
          placeholder="请输入用户ID"
          clearable
          class="!w-[200px]"
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item label="IP地址：" prop="ipaddress">
        <el-input
          v-model="form.ipaddress"
          placeholder="请输入IP地址"
          clearable
          class="!w-[200px]"
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item label="操作系统：" prop="system">
        <el-input
          v-model="form.system"
          placeholder="请输入操作系统"
          clearable
          class="!w-[180px]"
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item label="浏览器：" prop="browser">
        <el-input
          v-model="form.browser"
          placeholder="请输入浏览器"
          clearable
          class="!w-[180px]"
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item label="接口地址：" prop="path">
        <el-input
          v-model="form.path"
          placeholder="请输入接口地址"
          clearable
          class="!w-[180px]"
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item label="排序：">
        <el-select
          v-model="form.ordering"
          style="width: 180px"
          @change="onSearch(true)"
          clearable
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
          搜索
        </el-button>
        <el-button :icon="useRenderIcon(Refresh)" @click="resetForm(formRef)">
          重置
        </el-button>
      </el-form-item>
    </el-form>

    <PureTableBar title="角色管理" :columns="columns" @refresh="onSearch(true)">
      <template #buttons>
        <el-popconfirm
          title="是否确认批量删除?"
          @confirm="handleManyDelete"
          v-if="hasAuth('manyDelete:systemOperationLog')"
        >
          <template #reference>
            <el-button type="danger" plain :icon="useRenderIcon(Delete)">
              批量删除
            </el-button>
          </template>
        </el-popconfirm>
      </template>
      <template v-slot="{ size, dynamicColumns }">
        <pure-table
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
              :title="`是否确认删除角色名称为${row.module}的这条数据`"
              @confirm="handleDelete(row)"
              v-if="hasAuth('delete:systemOperationLog')"
            >
              <template #reference>
                <el-button
                  class="reset-margin"
                  link
                  type="primary"
                  :size="size"
                  :icon="useRenderIcon(Delete)"
                >
                  删除
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
:deep(.el-dropdown-menu__item i) {
  margin: 0;
}

.search-form {
  :deep(.el-form-item) {
    margin-bottom: 12px;
  }
}
</style>
