<script setup lang="ts">
import { ref } from "vue";
import { useMoviesFilm } from "./utils/hook";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

import Delete from "@iconify-icons/ep/delete";
import EditPen from "@iconify-icons/ep/edit-pen";
import Search from "@iconify-icons/ep/search";
import Refresh from "@iconify-icons/ep/refresh";
import AddFill from "@iconify-icons/ri/add-circle-line";
import AddFill1 from "@iconify-icons/ri/add-box-line";
import Eye from "@iconify-icons/ri/eye-line";
import { hasAuth } from "@/router/utils";
import { getIndexType } from "@/utils";
import More from "@iconify-icons/ep/more-filled";
import Picture from "@iconify-icons/ep/picture-filled";

defineOptions({
  name: "MoviesFilm"
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
  buttonClass,
  categoryData,
  channelData,
  languageData,
  regionData,
  manySelectCount,
  onSelectionCancel,
  onSearch,
  resetForm,
  openDialog,
  handleUpload,
  handleDelete,
  addDoubanFilm,
  handleAddSwipe,
  handleManyDelete,
  handleSizeChange,
  handleAddEpisode,
  handleCurrentChange,
  openImportFileDialog,
  handleBatchAddEpisode,
  handleSelectionChange
} = useMoviesFilm(tableRef);
</script>

<template>
  <div v-if="hasAuth('list:MoviesFilm')" class="main">
    <el-form
      ref="formRef"
      :inline="true"
      :model="form"
      class="search-form bg-bg_color w-[99/100] pl-8 pt-[12px]"
    >
      <el-form-item :label="t('MoviesFilm.name')" prop="name">
        <el-input
          v-model="form.name"
          :placeholder="t('MoviesFilm.name')"
          clearable
          class="!w-[200px]"
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item :label="t('MoviesFilm.starring')" prop="starring">
        <el-input
          v-model="form.starring"
          :placeholder="t('MoviesFilm.starring')"
          clearable
          class="!w-[180px]"
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item :label="t('MoviesFilm.channel')" prop="channel">
        <el-select
          v-model="form.channel"
          filterable
          clearable
          :placeholder="t('MoviesFilm.channel')"
          class="!w-[180px]"
          @change="onSearch(true)"
        >
          <el-option
            v-for="item in channelData"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('MoviesFilm.region')" prop="region">
        <el-select
          v-model="form.region"
          filterable
          clearable
          :placeholder="t('MoviesFilm.region')"
          class="!w-[180px]"
          @change="onSearch(true)"
        >
          <el-option
            v-for="item in regionData"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('MoviesFilm.language')" prop="language">
        <el-select
          v-model="form.language"
          filterable
          clearable
          :placeholder="t('MoviesFilm.language')"
          class="!w-[180px]"
          @change="onSearch(true)"
        >
          <el-option
            v-for="item in languageData"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('labels.remark')" prop="description">
        <el-input
          v-model="form.description"
          :placeholder="t('labels.remark')"
          clearable
          class="!w-[180px]"
          @keyup.enter="onSearch(true)"
        />
      </el-form-item>
      <el-form-item :label="t('labels.status')" prop="enable">
        <el-select
          v-model="form.enable"
          filterable
          clearable
          class="!w-[180px]"
          @change="onSearch(true)"
        >
          <el-option :label="t('labels.enable')" value="1" />
          <el-option :label="t('labels.disable')" value="0" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('MoviesFilm.category')" prop="category">
        <el-select
          v-model="form.category"
          filterable
          multiple
          clearable
          :placeholder="t('MoviesFilm.category')"
          style="width: 100%"
          @change="onSearch(true)"
        >
          <el-option
            v-for="item in categoryData"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item :label="t('MoviesFilm.releaseDate')" prop="releaseDate">
        <el-date-picker
          v-model="form.release_date"
          type="daterange"
          unlink-panels
          range-separator="To"
          start-placeholder="Start date"
          end-placeholder="End date"
          value-format="YYYY-MM-DD"
          @change="onSearch(true)"
        />
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
      :title="t('MoviesFilm.film')"
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
              v-if="hasAuth('manyDelete:MoviesFilm')"
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
            v-if="hasAuth('search:MoviesDoubanFilm')"
            :icon="useRenderIcon(AddFill)"
            type="primary"
            @click="openImportFileDialog"
          >
            {{ t("MoviesFilm.doubanSearch") }}
          </el-button>
          <el-button
            v-if="hasAuth('create:MoviesFilm')"
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
          <template #category="{ row }">
            <el-space wrap>
              <el-tag
                v-for="(item, index) in row.category_info"
                :key="item.value"
                :type="getIndexType(index + 1)"
              >
                {{ item.label }}
              </el-tag>
            </el-space>
          </template>
          <template #language="{ row }">
            <el-space wrap>
              <el-tag
                v-for="(item, index) in row.language_info"
                :key="item.value"
                :type="getIndexType(index + 1)"
              >
                {{ item.label }}
              </el-tag>
            </el-space>
          </template>
          <template #channel="{ row }">
            <el-space wrap>
              <el-tag
                v-for="(item, index) in row.channel_info"
                :key="item.value"
                :type="getIndexType(index + 1)"
              >
                {{ item.label }}
              </el-tag>
            </el-space>
          </template>
          <template #operation="{ row }">
            <el-button
              v-if="hasAuth('update:MoviesFilm')"
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
              v-if="hasAuth('delete:MoviesFilm')"
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
                  <el-dropdown-item v-if="hasAuth('upload:MoviesFilmPoster')">
                    <el-button
                      :class="buttonClass"
                      link
                      type="primary"
                      :size="size"
                      :icon="useRenderIcon(Picture)"
                      @click="handleUpload(row)"
                    >
                      {{ t("MoviesFilm.updatePoster") }}
                    </el-button>
                  </el-dropdown-item>
                  <el-dropdown-item>
                    <el-button
                      :class="buttonClass"
                      link
                      type="primary"
                      :size="size"
                      :icon="useRenderIcon(AddFill)"
                      @click="handleAddEpisode(row, 'true')"
                    >
                      {{ t("MoviesFilm.addEpisode") }}
                    </el-button>
                  </el-dropdown-item>
                  <el-dropdown-item v-if="hasAuth('batch:MoviesFileToFilm')">
                    <el-button
                      :class="buttonClass"
                      :icon="useRenderIcon(AddFill1)"
                      :size="size"
                      link
                      type="primary"
                      @click="handleBatchAddEpisode(row)"
                    >
                      {{ t("MoviesFilm.batchAddEpisode") }}
                    </el-button>
                  </el-dropdown-item>
                  <el-dropdown-item>
                    <el-button
                      :class="buttonClass"
                      link
                      type="primary"
                      :size="size"
                      :icon="useRenderIcon(Eye)"
                      @click="handleAddEpisode(row, 'false')"
                    >
                      {{ t("MoviesFilm.getEpisode") }}
                    </el-button>
                  </el-dropdown-item>
                  <el-dropdown-item>
                    <el-button
                      :class="buttonClass"
                      link
                      type="primary"
                      :size="size"
                      :icon="useRenderIcon(AddFill)"
                      @click="handleAddSwipe(row)"
                    >
                      {{ t("MoviesFilm.addSwipe") }}
                    </el-button>
                  </el-dropdown-item>
                  <el-dropdown-item v-if="hasAuth('create:MoviesDoubanFilm')">
                    <el-button
                      :class="buttonClass"
                      :icon="useRenderIcon(Refresh)"
                      :size="size"
                      link
                      type="primary"
                      @click="addDoubanFilm(row)"
                    >
                      {{ t("MoviesFilm.doubanAdd") }}
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
