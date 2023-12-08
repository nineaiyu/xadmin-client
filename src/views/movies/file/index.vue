<script setup lang="ts">
import { ref } from "vue";
import { useFile } from "./utils/hook";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Delete from "@iconify-icons/ep/delete";
import Search from "@iconify-icons/ep/search";
import Refresh from "@iconify-icons/ep/refresh";
import { hasAuth } from "@/router/utils";
import Eye from "@iconify-icons/ri/eye-line";
import Download from "@iconify-icons/ri/download-2-line";
import AddFill from "@iconify-icons/ri/add-circle-line";
import More from "@iconify-icons/ep/more-filled";
import Sync from "@iconify-icons/ri/24-hours-line";

defineOptions({
  name: "MoviesFile"
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
  usedOptions,
  manySelectCount,
  onSelectionCancel,
  onSearch,
  resetForm,
  openDialog,
  handelUpload,
  handleDelete,
  syncFileInfo,
  makeDownloadUrl,
  handleManyDelete,
  handleSizeChange,
  handleDownloadFile,
  handleCurrentChange,
  handleSelectionChange
} = useFile(tableRef);
</script>

<template>
  <div v-if="hasAuth('list:MoviesFile')" class="main">
    <el-form
      ref="formRef"
      :inline="true"
      :model="form"
      class="search-form bg-bg_color w-[99/100] pl-8 pt-[12px]"
    >
      <el-form-item :label="t('MoviesFile.name')" prop="userid">
        <el-input
          v-model="form.name"
          :placeholder="t('MoviesFile.name')"
          clearable
          class="!w-[200px]"
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item :label="t('labels.remark')" prop="description">
        <el-input
          v-model="form.description"
          :placeholder="t('labels.remark')"
          clearable
          class="!w-[200px]"
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item :label="t('MoviesDrive.driveId')" prop="drive_id">
        <el-input
          v-model="form.drive_id"
          :placeholder="t('MoviesDrive.driveId')"
          clearable
          class="!w-[200px]"
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item :label="t('MoviesFile.fileId')" prop="file_id">
        <el-input
          v-model="form.file_id"
          :placeholder="t('MoviesFile.fileId')"
          clearable
          class="!w-[200px]"
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item :label="t('labels.status')">
        <el-select
          v-model="form.used"
          filterable
          style="width: 180px"
          clearable
          @change="onSearch(true)"
        >
          <el-option
            v-for="item in usedOptions"
            :key="item.key"
            :label="item.label"
            :value="item.key"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('labels.sort')">
        <el-select
          v-model="form.ordering"
          filterable
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
      :title="t('MoviesFile.file')"
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
              v-if="hasAuth('manyDelete:MoviesFile')"
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
            v-if="hasAuth('upload:MoviesEpisodeAuthSid')"
            type="primary"
            :icon="useRenderIcon(AddFill)"
            @click="handelUpload"
          >
            {{ t("buttons.hsadd") }}
          </el-button>
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
              v-if="hasAuth('get:MoviesFileDownloadUrl')"
              link
              type="primary"
              :size="size"
              :icon="useRenderIcon(Download)"
              @click="handleDownloadFile(row)"
            >
              {{ t("MoviesFile.download") }}
            </el-button>
            <el-popconfirm
              v-if="hasAuth('delete:MoviesFile')"
              :title="t('buttons.hsconfirmdelete')"
              @confirm="handleDelete(row)"
            >
              <template #reference>
                <el-button
                  link
                  type="danger"
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
                  <el-dropdown-item v-if="hasAuth('sync:MoviesFileInfo')">
                    <el-button
                      link
                      :size="size"
                      :icon="useRenderIcon(Sync)"
                      @click="syncFileInfo(row)"
                    >
                      {{ t("MoviesFile.syncInfo") }}
                    </el-button>
                  </el-dropdown-item>
                  <el-dropdown-item>
                    <el-button
                      v-copy:click="makeDownloadUrl(row)"
                      link
                      :size="size"
                      :icon="useRenderIcon(Eye)"
                    >
                      {{ t("MoviesFile.copy") }}
                    </el-button>
                  </el-dropdown-item>

                  <el-dropdown-item
                    v-if="
                      hasAuth('get:MoviesFilePreviewUrl') &&
                      row.category === 'video'
                    "
                  >
                    <el-button
                      link
                      :size="size"
                      :icon="useRenderIcon(Eye)"
                      @click="openDialog(row)"
                    >
                      {{ t("MoviesFile.preview") }}
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
</template>
