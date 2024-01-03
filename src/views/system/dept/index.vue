<script setup lang="ts">
import { ref } from "vue";
import { useDept } from "./utils/hook";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

import More from "@iconify-icons/ep/more-filled";
import Delete from "@iconify-icons/ep/delete";
import Role from "@iconify-icons/ri/admin-line";
import EditPen from "@iconify-icons/ep/edit-pen";
import Search from "@iconify-icons/ep/search";
import Refresh from "@iconify-icons/ep/refresh";
import AddFill from "@iconify-icons/ri/add-circle-line";
import { hasAuth } from "@/router/utils";
import { getIndexType } from "@/utils";

defineOptions({
  name: "Dept"
});

const formRef = ref();
const tableRef = ref();
const {
  t,
  form,
  loading,
  columns,
  dataList,
  buttonClass,
  sortOptions,
  choicesDict,
  manySelectCount,
  onSearch,
  resetForm,
  openDialog,
  handleRole,
  handleDelete,
  handleManyDelete,
  onSelectionCancel,
  handleSelectionChange
} = useDept(tableRef);
</script>

<template>
  <div v-if="hasAuth('list:systemDept')" class="main">
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
            :placeholder="t('labels.id')"
            clearable
            class="!w-[160px]"
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item :label="t('dept.name')" prop="name">
          <el-input
            v-model="form.name"
            :placeholder="t('dept.name')"
            clearable
            class="!w-[160px]"
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item :label="t('dept.code')" prop="code">
          <el-input
            v-model="form.code"
            :placeholder="t('dept.code')"
            clearable
            class="!w-[160px]"
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item :label="t('labels.description')" prop="description">
          <el-input
            v-model="form.description"
            :placeholder="t('labels.description')"
            clearable
            class="!w-[160px]"
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item :label="t('dept.autoBind')" prop="auto_bind">
          <el-select
            v-model="form.auto_bind"
            clearable
            class="!w-[180px]"
            @change="onSearch"
          >
            <el-option :label="t('labels.enable')" value="1" />
            <el-option :label="t('labels.disable')" value="0" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('labels.status')" prop="is_active">
          <el-select
            v-model="form.is_active"
            :placeholder="t('labels.status')"
            clearable
            class="!w-[160px]"
            @change="onSearch"
          >
            <el-option :label="t('labels.active')" value="1" />
            <el-option :label="t('labels.inactive')" value="0" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('permission.mode')" prop="mode">
          <el-select
            v-model="form.mode_type"
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
            @change="onSearch"
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
            @click="onSearch"
          >
            {{ t("buttons.hssearch") }}
          </el-button>
          <el-button :icon="useRenderIcon(Refresh)" @click="resetForm(formRef)">
            {{ t("buttons.hsreload") }}
          </el-button>
        </el-form-item>
      </el-form>

      <PureTableBar
        :title="t('menus.hsDept')"
        :columns="columns"
        @refresh="onSearch"
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
                v-if="hasAuth('manyDelete:systemDept')"
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
              v-if="hasAuth('create:systemDept')"
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
            :adaptiveConfig="{ offsetBottom: 32 }"
            align-whole="center"
            table-layout="auto"
            default-expand-all
            :loading="loading"
            row-key="pk"
            :size="size"
            :data="dataList"
            showOverflowTooltip
            :columns="dynamicColumns"
            :header-cell-style="{
              background: 'var(--el-table-row-hover-bg-color)',
              color: 'var(--el-text-color-primary)'
            }"
            @selection-change="handleSelectionChange"
          >
            <template #roles="{ row }">
              <el-space wrap>
                <el-tag
                  v-for="(role, index) in row.roles_info"
                  :key="role.pk"
                  :type="getIndexType(index + 1)"
                >
                  {{ role.name }}
                </el-tag>
              </el-space>
            </template>
            <template #rules="{ row }">
              <el-space wrap>
                <el-tag
                  v-for="(role, index) in row.rules_info"
                  :key="role.pk"
                  :type="getIndexType(index + 1)"
                >
                  {{ role.name }}
                </el-tag>
              </el-space>
            </template>
            <template #operation="{ row }">
              <el-button
                v-if="hasAuth('update:systemDept')"
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
                v-if="hasAuth('delete:systemDept')"
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
                    <el-dropdown-item v-if="hasAuth('empower:systemDeptRole')">
                      <el-button
                        :class="buttonClass"
                        link
                        type="primary"
                        :size="size"
                        :icon="useRenderIcon(Role)"
                        @click="handleRole(row)"
                      >
                        {{ t("dept.assignRoles") }}
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
