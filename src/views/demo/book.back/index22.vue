<script lang="ts" setup>
import { nextTick, onMounted, reactive, ref } from "vue";
import { type FieldValues, PlusSearch } from "plus-pro-components";
import { PureTableBar } from "@/components/RePureTableBar";
import { delay, deviceDetection } from "@pureadmin/utils";
import PureTable from "@pureadmin/table";
import { useBaseColumns } from "@/components/RePlusCRUD/src/utils/columns";
import { BaseApi } from "@/api/base";
import { cloneDeep } from "lodash-es";

defineOptions({
  name: "DemoBook"
});

const tableRef = ref();

const pagination = reactive({
  total: 0,
  pageSize: 100,
  currentPage: 1,
  pageSizes: [20, 100, 200, 300, 800],
  background: true
});

const plusSearchInstance = ref();
const loadingStatus = ref(false);
const dataList = ref([]);

const {
  listColumns,
  showColumns,
  searchColumns,
  getColumnData,
  addOrEditRules,
  addOrEditColumns,
  searchDefaultValue,
  addOrEditDefaultValue
} = useBaseColumns();

const bookApi = new BaseApi("/api/demo/book");
bookApi.update = bookApi.patch;

onMounted(() => {
  getColumnData(bookApi, () => {
    searchParams.value = { ...searchDefaultValue.value };
    nextTick(() => {
      plusSearchInstance.value?.handleReset();
    });
  });
});

const searchParams = ref({});
const getList = () => {
  loadingStatus.value = true;
  bookApi
    .list(searchParams.value)
    .then(res => {
      dataList.value = res.data.results;
      delay(500).then(() => {
        loadingStatus.value = false;
      });
    })
    .catch(() => {
      loadingStatus.value = false;
    });
};

const handleRest = () => {
  getList();
};

const handleSearch = (val: FieldValues) => {
  // const data =
  //   (props.beforeSearchSubmit && props.beforeSearchSubmit(val)) || val;
  // values.value = data;
  // searchParams.value.page = 1;
  getList();
};
</script>

<template>
  <div>
    <el-card>
      <plus-search
        ref="plusSearchInstance"
        v-model="searchParams"
        :default-values="cloneDeep(searchDefaultValue)"
        :columns="searchColumns"
        :search-loading="loadingStatus"
        :col-props="{ xs: 24, sm: 12, md: 6, lg: 6, xl: 6 }"
        :show-number="deviceDetection() ? 1 : 3"
        label-width="auto"
        @search="handleSearch"
        @reset="handleRest"
      />
    </el-card>

    <PureTableBar :columns="listColumns" @refresh="getList">
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
          :loading="loadingStatus"
          :pagination="pagination"
          :paginationSmall="size === 'small'"
          :size="size"
          adaptive
          align-whole="center"
          default-expand-all
          row-key="pk"
          showOverflowTooltip
          table-layout="auto"
        />
      </template>
    </PureTableBar>
  </div>
</template>
