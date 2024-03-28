<script lang="ts" setup>
import { ref } from "vue";
import { useUser } from "./utils/hook";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import tree from "./tree.vue";
import Password from "@iconify-icons/ri/lock-password-line";
import Avatar from "@iconify-icons/ri/user-3-fill";
import More from "@iconify-icons/ep/more-filled";
import Delete from "@iconify-icons/ep/delete";
import Role from "@iconify-icons/ri/admin-line";
import EditPen from "@iconify-icons/ep/edit-pen";
import AddFill from "@iconify-icons/ri/add-circle-line";
import Download from "@iconify-icons/ri/download-line";
import Message from "@iconify-icons/ri/message-fill";
import { hasAuth, hasGlobalAuth } from "@/router/utils";
import { getIndexType } from "@/utils";
import { plusPorChange } from "@/views/system/hooks";
import { cloneDeep } from "@pureadmin/utils";

defineOptions({
  name: "SystemUser"
});

const tableRef = ref();
const treeRef = ref();

const {
  t,
  form,
  loading,
  columns,
  dataList,
  treeData,
  pagination,
  buttonClass,
  treeLoading,
  selectedNum,
  searchColumns,
  onSearch,
  goNotice,
  handleRole,
  openDialog,
  exportExcel,
  handleDelete,
  onTreeSelect,
  handleUpload,
  handleReset,
  deviceDetection,
  handleManyDelete,
  handleSizeChange,
  onSelectionCancel,
  handleCurrentChange,
  handleSelectionChange
} = useUser(tableRef);

const defaultValue = cloneDeep(form.value);
</script>

<template>
  <div
    v-if="hasAuth('list:systemUser')"
    :class="['flex', 'justify-between', deviceDetection() && 'flex-wrap']"
  >
    <tree
      ref="treeRef"
      :pk="form.dept?.toString()"
      :treeData="treeData"
      :treeLoading="treeLoading"
      :class="['mr-2', deviceDetection() ? 'w-full' : 'min-w-[250px]']"
      @tree-select="onTreeSelect"
    />
    <div
      :class="[deviceDetection() ? ['w-full', 'mt-2'] : 'w-[calc(100%-250px)]']"
    >
      <div class="search-form bg-bg_color w-[99/100] pl-8 pr-8 pt-[12px]">
        <PlusSearch
          v-model="form"
          :col-props="{
            xs: 24,
            sm: 12,
            md: 6,
            lg: 6,
            xl: 6
          }"
          :columns="searchColumns"
          :default-values="defaultValue"
          :row-props="{
            gutter: 24
          }"
          :search-loading="loading"
          :show-number="deviceDetection() ? 1 : 3"
          label-width="auto"
          @change="
            (values: any, column) => {
              plusPorChange(column, onSearch, true);
            }
          "
          @reset="
            () => {
              treeRef.onTreeReset();
              onSearch(true);
            }
          "
          @search="onSearch"
          @keyup.enter="onSearch"
        />
      </div>
      <PureTableBar
        :columns="columns"
        :title="t('menus.userManagement')"
        @refresh="onSearch(true)"
      >
        <template #title>
          <el-space>
            <p class="font-bold truncate">{{ t("menus.userManagement") }}</p>
            <div
              v-if="selectedNum > 0"
              v-motion-fade
              class="bg-[var(--el-fill-color-light)] w-full h-[46px] m-2 pl-4 flex items-center rounded-md"
            >
              <span
                class="text-[rgba(42,46,54,0.5)] dark:text-[rgba(220,220,242,0.5)]"
                style="font-size: var(--el-font-size-base)"
              >
                {{ t("buttons.selected", { count: selectedNum }) }}
              </span>
              <el-button text type="primary" @click="onSelectionCancel">
                {{ t("buttons.cancel") }}
              </el-button>
            </div>
          </el-space>
        </template>
        <template #buttons>
          <el-space wrap>
            <div v-if="selectedNum > 0" v-motion-fade>
              <el-popconfirm
                v-if="hasAuth('manyDelete:systemUser')"
                :title="t('buttons.batchDeleteConfirm', { count: selectedNum })"
                @confirm="handleManyDelete"
              >
                <template #reference>
                  <el-button :icon="useRenderIcon(Delete)" plain type="danger">
                    {{ t("buttons.batchDelete") }}
                  </el-button>
                </template>
              </el-popconfirm>
              <el-button
                v-if="hasGlobalAuth('create:systemNotice')"
                :icon="useRenderIcon(Message)"
                plain
                type="primary"
                @click="goNotice()"
              >
                {{ t("user.batchSendNotice") }}
              </el-button>
            </div>
            <el-button
              v-if="false"
              v-optimize="{
                event: 'click',
                fn: exportExcel,
                immediate: true,
                timeout: 5000
              }"
              :icon="useRenderIcon(Download)"
              type="primary"
            >
              {{ t("user.exportExcel") }}
            </el-button>
            <el-button
              v-if="hasAuth('create:systemUser')"
              :icon="useRenderIcon(AddFill)"
              type="primary"
              @click="openDialog()"
            >
              {{ t("buttons.add") }}
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
            table-layout="auto"
            @selection-change="handleSelectionChange"
            @page-size-change="handleSizeChange"
            @page-current-change="handleCurrentChange"
          >
            <template #roles="{ row }">
              <el-space>
                <el-text
                  v-for="(role, index) in row.roles_info"
                  :key="role.pk"
                  :type="getIndexType(index + 1)"
                >
                  {{ role.name }}
                </el-text>
              </el-space>
            </template>
            <template #rules="{ row }">
              <el-space>
                <el-text
                  v-for="(role, index) in row.rules_info"
                  :key="role.pk"
                  :type="getIndexType(index + 1)"
                >
                  {{ role.name }}
                </el-text>
              </el-space>
            </template>
            <template #operation="{ row }">
              <el-button
                v-if="hasAuth('update:systemUser')"
                :icon="useRenderIcon(EditPen)"
                :size="size"
                class="reset-margin"
                link
                type="primary"
                @click="openDialog(false, row)"
              >
                {{ t("buttons.edit") }}
              </el-button>
              <el-popconfirm
                v-if="hasAuth('delete:systemUser')"
                :title="t('buttons.confirmDelete')"
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
                    {{ t("buttons.delete") }}
                  </el-button>
                </template>
              </el-popconfirm>

              <el-dropdown>
                <el-button
                  :icon="useRenderIcon(More)"
                  :size="size"
                  class="ml-3 mt-[2px]"
                  link
                  type="primary"
                />
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item v-if="hasAuth('upload:systemAvatar')">
                      <el-button
                        :class="buttonClass"
                        :icon="useRenderIcon(Avatar)"
                        :size="size"
                        link
                        type="primary"
                        @click="handleUpload(row)"
                      >
                        {{ t("user.editAvatar") }}
                      </el-button>
                    </el-dropdown-item>
                    <el-dropdown-item v-if="hasAuth('update:systemUserPwd')">
                      <el-button
                        :class="buttonClass"
                        :icon="useRenderIcon(Password)"
                        :size="size"
                        link
                        type="primary"
                        @click="handleReset(row)"
                      >
                        {{ t("user.resetPassword") }}
                      </el-button>
                    </el-dropdown-item>
                    <el-dropdown-item v-if="hasAuth('empower:systemUserRole')">
                      <el-button
                        :class="buttonClass"
                        :icon="useRenderIcon(Role)"
                        :size="size"
                        link
                        type="primary"
                        @click="handleRole(row)"
                      >
                        {{ t("user.assignRoles") }}
                      </el-button>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </template>
          </pure-table>
        </template>
      </PureTableBar>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-dropdown-menu__item i) {
  margin: 0;
}

.search-form {
  :deep(.el-form-item) {
    margin-bottom: 12px;
  }
}

.main-content {
  margin: 24px 24px 0 !important;
}
</style>
