<script setup lang="ts">
import { ref } from "vue";
import { useNotice } from "./utils/hook";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

import Delete from "@iconify-icons/ep/delete";
import Search from "@iconify-icons/ep/search";
import Refresh from "@iconify-icons/ep/refresh";
import { hasAuth } from "@/router/utils";
import EditPen from "@iconify-icons/ep/edit-pen";
import AddFill from "@iconify-icons/ri/add-circle-line";
import Eye from "@iconify-icons/ri/eye-fill";
defineOptions({
  name: "Notice"
});

const formRef = ref();
const tableRef = ref();
const {
  form,
  loading,
  columns,
  dataList,
  pagination,
  sortOptions,
  manySelectCount,
  levelChoices,
  noticeChoices,
  onSelectionCancel,
  onSearch,
  resetForm,
  openDialog,
  showDialog,
  handleDelete,
  handleManyDelete,
  handleSizeChange,
  handleCurrentChange,
  handleSelectionChange
} = useNotice(tableRef);
</script>

<template>
  <div class="main" v-if="hasAuth('list:systemNotice')">
    <el-form
      ref="formRef"
      :inline="true"
      :model="form"
      class="search-form bg-bg_color w-[99/100] pl-8 pt-[12px]"
    >
      <el-form-item label="ID：" prop="pk">
        <el-input
          v-model="form.pk"
          placeholder="请输入消息ID"
          clearable
          class="!w-[100px]"
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item label="标题：" prop="title">
        <el-input
          v-model="form.title"
          placeholder="请输入消息标题"
          clearable
          class="!w-[200px]"
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item label="消息内容：" prop="message">
        <el-input
          v-model="form.message"
          placeholder="请输入消息内容"
          clearable
          class="!w-[180px]"
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item label="是否发布：" prop="unread">
        <el-select
          v-model="form.publish"
          placeholder="请选择"
          clearable
          class="!w-[160px]"
          @change="onSearch(true)"
        >
          <el-option label="已发布" :value="true" />
          <el-option label="未发布" :value="false" />
        </el-select>
      </el-form-item>
      <el-form-item label="通知级别" prop="level">
        <el-select
          v-model="form.level"
          class="filter-item"
          style="width: 180px"
          @change="onSearch(true)"
          clearable
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
      <el-form-item label="通知类型" prop="level">
        <el-select
          v-model="form.notice_type"
          class="filter-item"
          style="width: 180px"
          @change="onSearch(true)"
          clearable
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

    <PureTableBar
      title="消息公告管理"
      :columns="columns"
      @refresh="onSearch(true)"
    >
      <template #buttons>
        <div v-if="manySelectCount > 0" class="w-[300px]">
          <span
            style="font-size: var(--el-font-size-base)"
            class="text-[rgba(42,46,54,0.5)] dark:text-[rgba(220,220,242,0.5)]"
          >
            已选 {{ manySelectCount }} 项
          </span>
          <el-button type="primary" text @click="onSelectionCancel">
            取消选择
          </el-button>
          <el-popconfirm
            :title="`是否确认批量删除${manySelectCount}条数据?`"
            @confirm="handleManyDelete"
            v-if="hasAuth('manyDelete:systemNotice')"
          >
            <template #reference>
              <el-button type="danger" plain :icon="useRenderIcon(Delete)">
                批量删除
              </el-button>
            </template>
          </el-popconfirm>
        </div>
        <el-button
          v-if="hasAuth('create:systemNotice')"
          type="primary"
          :icon="useRenderIcon(AddFill)"
          @click="openDialog()"
        >
          新增消息公告
        </el-button>
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
              class="reset-margin"
              link
              type="primary"
              v-if="hasAuth('list:systemNotice')"
              :size="size"
              @click="showDialog(row)"
              :icon="useRenderIcon(Eye)"
            >
              查看
            </el-button>
            <el-button
              class="reset-margin"
              link
              type="primary"
              v-if="hasAuth('update:systemNotice')"
              :size="size"
              @click="openDialog('编辑', row)"
              :icon="useRenderIcon(EditPen)"
            >
              修改
            </el-button>
            <el-popconfirm
              :title="`是否确认删除消息名称为 ${row.title} 的这条数据?`"
              @confirm="handleDelete(row)"
              v-if="hasAuth('delete:systemNotice')"
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
