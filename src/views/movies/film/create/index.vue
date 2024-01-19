<script setup lang="ts">
import { ref } from "vue";
import { useSearchFile } from "./hook";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Search from "@iconify-icons/ep/search";
import { hasAuth } from "@/router/utils";
import AddFill from "@iconify-icons/ri/add-circle-line";

const formRef = ref();
const tableRef = ref();
const { t, form, loading, columns, dataList, onSearch, addDoubanFilm } =
  useSearchFile();
</script>

<template>
  <div v-if="hasAuth('search:MoviesDoubanFilm')" class="main">
    <el-form
      ref="formRef"
      :inline="true"
      :model="form"
      class="search-form bg-bg_color w-[99/100] pl-8 pt-[12px]"
    >
      <el-form-item :label="t('MoviesFile.name')" prop="name">
        <el-input
          v-model="form.key"
          :placeholder="t('MoviesFile.name')"
          clearable
          class="!w-[400px]"
          @keyup.enter="onSearch()"
        />
      </el-form-item>
      <el-form-item>
        <el-button
          type="primary"
          :icon="useRenderIcon(Search)"
          :loading="loading"
          @click="onSearch()"
        >
          {{ t("buttons.hssearch") }}
        </el-button>
        <el-button
          v-if="hasAuth('create:MoviesDoubanFilm')"
          :icon="useRenderIcon(AddFill)"
          @click="addDoubanFilm({ url: form.key })"
        >
          直接添加
        </el-button>
      </el-form-item>
    </el-form>

    <PureTableBar
      :title="t('MoviesFilm.films')"
      :columns="columns"
      @refresh="onSearch()"
    >
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
          :paginationSmall="size === 'small'"
          :header-cell-style="{
            background: 'var(--el-table-row-hover-bg-color)',
            color: 'var(--el-text-color-primary)'
          }"
        >
          <template #operation="{ row }">
            <el-button
              v-if="hasAuth('create:MoviesDoubanFilm')"
              class="reset-margin"
              link
              type="primary"
              :size="size"
              :icon="useRenderIcon(AddFill)"
              @click="addDoubanFilm(row)"
            >
              自动添加
            </el-button>
          </template>
        </pure-table>
      </template>
    </PureTableBar>
  </div>
</template>
