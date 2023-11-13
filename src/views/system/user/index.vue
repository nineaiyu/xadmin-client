<script setup lang="ts">
import { ref } from "vue";
import { useUser } from "./utils/hook";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

import Password from "@iconify-icons/ri/lock-password-line";
import Avatar from "@iconify-icons/ri/user-3-fill";
import More from "@iconify-icons/ep/more-filled";
import Delete from "@iconify-icons/ep/delete";
import Role from "@iconify-icons/ri/admin-line";
import EditPen from "@iconify-icons/ep/edit-pen";
import Search from "@iconify-icons/ep/search";
import Refresh from "@iconify-icons/ep/refresh";
import AddFill from "@iconify-icons/ri/add-circle-line";
import Download from "@iconify-icons/ri/download-line";
import Message from "@iconify-icons/ri/message-fill";
import { hasAuth } from "@/router/utils";
import { getIndexType } from "@/utils";

defineOptions({
  name: "User"
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
  buttonClass,
  sortOptions,
  manySelectCount,
  onSearch,
  exportExcel,
  resetForm,
  openDialog,
  goNotice,
  handleDelete,
  handleManyDelete,
  onSelectionCancel,
  handleSizeChange,
  handleUpload,
  handleReset,
  handleRole,
  handleCurrentChange,
  handleSelectionChange
} = useUser(tableRef);
</script>

<template>
  <div v-if="hasAuth('list:systemUser')" class="main">
    <div class="float-left w-[99%]">
      <el-form
        ref="formRef"
        :inline="true"
        :model="form"
        class="search-form bg-bg_color w-[99/100] pl-8 pt-[12px]"
      >
        <el-form-item :label="t('labels.id')" prop="pk">
          <el-input
            v-model="form.pk"
            :placeholder="t('user.verifyUserId')"
            clearable
            class="!w-[160px]"
            @keyup.enter="onSearch(true)"
          />
        </el-form-item>
        <el-form-item :label="t('user.username')" prop="username">
          <el-input
            v-model="form.username"
            :placeholder="t('user.verifyUsername')"
            clearable
            class="!w-[160px]"
            @keyup.enter="onSearch(true)"
          />
        </el-form-item>
        <el-form-item :label="t('user.mobile')" prop="mobile">
          <el-input
            v-model="form.mobile"
            :placeholder="t('user.verifyMobile')"
            clearable
            class="!w-[160px]"
            @keyup.enter="onSearch(true)"
          />
        </el-form-item>
        <el-form-item :label="t('labels.status')" prop="is_active">
          <el-select
            v-model="form.is_active"
            :placeholder="t('labels.status')"
            clearable
            class="!w-[160px]"
            @change="onSearch(true)"
          >
            <el-option :label="t('labels.active')" value="1" />
            <el-option :label="t('labels.inactive')" value="0" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('labels.sort')">
          <el-select
            v-model="form.ordering"
            style="width: 180px"
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
        :title="t('menus.hsUser')"
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
                v-if="hasAuth('manyDelete:systemUser')"
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
            <el-button
              v-if="hasAuth('send:systemNotify') && manySelectCount > 0"
              type="primary"
              :icon="useRenderIcon(Message)"
              @click="goNotice()"
            >
              {{ t("user.batchSendNotice") }}
            </el-button>
            <el-button
              v-if="hasAuth('list:systemUser') && manySelectCount > 0"
              v-optimize="{
                event: 'click',
                fn: exportExcel,
                immediate: true,
                timeout: 5000
              }"
              type="primary"
              :icon="useRenderIcon(Download)"
            >
              {{ t("user.exportExcel") }}
            </el-button>
            <el-button
              v-if="hasAuth('create:systemUser')"
              type="primary"
              :icon="useRenderIcon(AddFill)"
              @click="openDialog()"
            >
              {{ t("buttons.hsadd") }}
            </el-button>
          </el-space>
        </template>
        <template v-slot="{ size, dynamicColumns }">
          <pure-table
            ref="tableRef"
            border
            adaptive
            align-whole="center"
            table-layout="auto"
            :loading="loading"
            row-key="pk"
            :size="size"
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
            <template #roles="{ row }">
              <el-tag
                v-for="(role, index) in row.roles_info"
                :key="role.pk"
                :type="getIndexType(index + 1)"
              >
                {{ role.name }}
              </el-tag>
            </template>
            <template #operation="{ row }">
              <el-button
                v-if="hasAuth('update:systemUser')"
                class="reset-margin"
                link
                type="primary"
                :size="size"
                :icon="useRenderIcon(EditPen)"
                @click="openDialog(false, row)"
              >
                {{ t("buttons.hsedit") }}
              </el-button>
              <el-popconfirm
                v-if="hasAuth('delete:systemUser')"
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

              <el-dropdown>
                <el-button
                  class="ml-3 mt-[2px]"
                  link
                  type="primary"
                  :size="size"
                  :icon="useRenderIcon(More)"
                />
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item v-if="hasAuth('upload:systemAvatar')">
                      <el-button
                        :class="buttonClass"
                        link
                        type="primary"
                        :size="size"
                        :icon="useRenderIcon(Avatar)"
                        @click="handleUpload(row)"
                      >
                        {{ t("user.editAvatar") }}
                      </el-button>
                    </el-dropdown-item>
                    <el-dropdown-item v-if="hasAuth('update:systemUserPwd')">
                      <el-button
                        :class="buttonClass"
                        link
                        type="primary"
                        :size="size"
                        :icon="useRenderIcon(Password)"
                        @click="handleReset(row)"
                      >
                        {{ t("user.resetPassword") }}
                      </el-button>
                    </el-dropdown-item>
                    <el-dropdown-item v-if="hasAuth('empower:systemRole')">
                      <el-button
                        :class="buttonClass"
                        link
                        type="primary"
                        :size="size"
                        :icon="useRenderIcon(Role)"
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
