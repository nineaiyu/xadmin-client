// 按需注册 element-plus：只有本仓库 src 中实际用到的组件才会进包。
//
// 维护约定（重要）：
// - 组件级按需引入不等于「自动按需」——本文件显式 import 并全局注册的组件，
//   打包器无法摇掉，注册多少就进多少。故清单必须与 src 中的真实用法保持一致。
// - 新增用法（模板 <el-…> 或运行时 import）时，须同步在此登记，否则运行时报
//   "Failed to resolve component: el-<name>"（Vue 的 resolveAsset 会按
//   el-a-b → elAB → ElAB 逐级回退查找全局注册名）。
//   注：`src/plugins/__tests__/elementPlus.spec.ts` 会扫描 src 中的用法并与本文件比对。
// - 清理未使用组件时按这两条线索核对：
//     grep -rhoE "(<el-|[\"'\`]el-)[a-z0-9-]+" src --include="*.vue" --include="*.ts" --include="*.tsx"
//     grep -rh -B12 'from "element-plus"' src --include="*.vue" --include="*.ts" --include="*.tsx"
//   子组件（如 ElOption/ElTableColumn/ElDescriptionsItem）虽不单独出现在模板之外，
//   也必须随父组件保留。
import type { App, Component } from "vue";
import {
  ElAlert,
  ElAside,
  ElAutocomplete,
  ElAvatar,
  ElBacktop,
  ElBadge,
  ElBreadcrumb,
  ElBreadcrumbItem,
  ElButton,
  ElButtonGroup,
  ElCard,
  ElCascader,
  ElCheckbox,
  ElCheckboxButton,
  ElCheckboxGroup,
  ElCol,
  ElColorPicker,
  ElCollapse,
  ElCollapseItem,
  ElConfigProvider,
  ElContainer,
  ElDatePicker,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElDivider,
  ElDrawer,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElEmpty,
  ElFooter,
  ElForm,
  ElFormItem,
  ElHeader,
  ElIcon,
  ElImage,
  ElInput,
  ElInputNumber,
  ElLink,
  ElMain,
  ElMenu,
  ElMenuItem,
  ElMenuItemGroup,
  ElOption,
  ElOptionGroup,
  ElPagination,
  ElPopconfirm,
  ElPopover,
  ElProgress,
  ElRadio,
  ElRadioButton,
  ElRadioGroup,
  ElResult,
  ElRow,
  ElScrollbar,
  ElSelect,
  ElSpace,
  ElSplitter,
  ElSplitterPanel,
  ElSubMenu,
  ElSwitch,
  ElTabPane,
  ElTable,
  ElTableColumn,
  ElTabs,
  ElTag,
  ElText,
  ElTimeline,
  ElTimelineItem,
  ElTooltip,
  ElTree,
  ElTreeSelect,
  ElUpload,
  // 插件（指令与全局属性对象）
  ElInfiniteScroll, // v-infinite-scroll 指令
  ElLoading, // v-loading 指令
  ElMessage, // $message 全局属性对象
  ElMessageBox, // $msgbox、$alert、$confirm、$prompt 全局属性对象
  ElNotification, // $notify 全局属性对象
  ElPopoverDirective // v-popover 指令
} from "element-plus";

// 组件样式按需引入：替代全量 `element-plus/dist/index.css`（380KB）。
// 每个 style/css 内部已声明自身依赖（如 dialog → overlay、select → input/popper/tag），
// 无需手动补齐被依赖组件。清单须与上面的 components/plugins 保持一致，
// 少了会「组件能跑但没样式」，多了则白付体积。
import "element-plus/es/components/alert/style/css";
import "element-plus/es/components/aside/style/css";
import "element-plus/es/components/autocomplete/style/css";
import "element-plus/es/components/avatar/style/css";
import "element-plus/es/components/backtop/style/css";
import "element-plus/es/components/badge/style/css";
import "element-plus/es/components/breadcrumb/style/css";
import "element-plus/es/components/breadcrumb-item/style/css";
import "element-plus/es/components/button/style/css";
import "element-plus/es/components/button-group/style/css";
import "element-plus/es/components/card/style/css";
import "element-plus/es/components/cascader/style/css";
import "element-plus/es/components/checkbox/style/css";
import "element-plus/es/components/checkbox-button/style/css";
import "element-plus/es/components/checkbox-group/style/css";
import "element-plus/es/components/color-picker/style/css";
import "element-plus/es/components/col/style/css";
import "element-plus/es/components/collapse/style/css";
import "element-plus/es/components/collapse-item/style/css";
import "element-plus/es/components/config-provider/style/css";
import "element-plus/es/components/container/style/css";
import "element-plus/es/components/date-picker/style/css";
import "element-plus/es/components/descriptions/style/css";
import "element-plus/es/components/descriptions-item/style/css";
import "element-plus/es/components/dialog/style/css";
import "element-plus/es/components/divider/style/css";
import "element-plus/es/components/drawer/style/css";
import "element-plus/es/components/dropdown/style/css";
import "element-plus/es/components/dropdown-item/style/css";
import "element-plus/es/components/dropdown-menu/style/css";
import "element-plus/es/components/empty/style/css";
import "element-plus/es/components/footer/style/css";
import "element-plus/es/components/form/style/css";
import "element-plus/es/components/form-item/style/css";
import "element-plus/es/components/header/style/css";
import "element-plus/es/components/icon/style/css";
import "element-plus/es/components/image/style/css";
import "element-plus/es/components/input/style/css";
import "element-plus/es/components/input-number/style/css";
import "element-plus/es/components/link/style/css";
import "element-plus/es/components/loading/style/css";
import "element-plus/es/components/main/style/css";
import "element-plus/es/components/menu/style/css";
import "element-plus/es/components/menu-item/style/css";
import "element-plus/es/components/menu-item-group/style/css";
import "element-plus/es/components/message/style/css";
import "element-plus/es/components/message-box/style/css";
import "element-plus/es/components/notification/style/css";
import "element-plus/es/components/option/style/css";
import "element-plus/es/components/option-group/style/css";
import "element-plus/es/components/pagination/style/css";
import "element-plus/es/components/popconfirm/style/css";
import "element-plus/es/components/popper/style/css";
import "element-plus/es/components/popover/style/css";
import "element-plus/es/components/progress/style/css";
import "element-plus/es/components/radio/style/css";
import "element-plus/es/components/radio-button/style/css";
import "element-plus/es/components/radio-group/style/css";
import "element-plus/es/components/result/style/css";
import "element-plus/es/components/row/style/css";
import "element-plus/es/components/scrollbar/style/css";
import "element-plus/es/components/select/style/css";
import "element-plus/es/components/space/style/css";
import "element-plus/es/components/splitter/style/css";
import "element-plus/es/components/splitter-panel/style/css";
import "element-plus/es/components/sub-menu/style/css";
import "element-plus/es/components/switch/style/css";
import "element-plus/es/components/tab-pane/style/css";
import "element-plus/es/components/table/style/css";
import "element-plus/es/components/table-column/style/css";
import "element-plus/es/components/tabs/style/css";
import "element-plus/es/components/tag/style/css";
import "element-plus/es/components/text/style/css";
import "element-plus/es/components/timeline/style/css";
import "element-plus/es/components/timeline-item/style/css";
import "element-plus/es/components/tooltip/style/css";
import "element-plus/es/components/tree/style/css";
import "element-plus/es/components/tree-select/style/css";
import "element-plus/es/components/upload/style/css";

const components = [
  ElAlert,
  ElAside,
  ElAutocomplete,
  ElAvatar,
  ElBacktop,
  ElBadge,
  ElBreadcrumb,
  ElBreadcrumbItem,
  ElButton,
  ElButtonGroup,
  ElCard,
  ElCascader,
  ElCheckbox,
  ElCheckboxButton,
  ElCheckboxGroup,
  ElCol,
  ElColorPicker,
  ElCollapse,
  ElCollapseItem,
  ElConfigProvider,
  ElContainer,
  ElDatePicker,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElDivider,
  ElDrawer,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElEmpty,
  ElFooter,
  ElForm,
  ElFormItem,
  ElHeader,
  ElIcon,
  ElImage,
  ElInput,
  ElInputNumber,
  ElLink,
  ElMain,
  ElMenu,
  ElMenuItem,
  ElMenuItemGroup,
  ElOption,
  ElOptionGroup,
  ElPagination,
  ElPopconfirm,
  ElPopover,
  ElProgress,
  ElRadio,
  ElRadioButton,
  ElRadioGroup,
  ElResult,
  ElRow,
  ElScrollbar,
  ElSelect,
  ElSpace,
  ElSplitter,
  ElSplitterPanel,
  ElSubMenu,
  ElSwitch,
  ElTabPane,
  ElTable,
  ElTableColumn,
  ElTabs,
  ElTag,
  ElText,
  ElTimeline,
  ElTimelineItem,
  ElTooltip,
  ElTree,
  ElTreeSelect,
  ElUpload
];

const plugins = [
  ElInfiniteScroll,
  ElLoading,
  ElMessage,
  ElMessageBox,
  ElNotification,
  ElPopoverDirective
];

/** 按需注册`element-plus` */
export function useElementPlus(app: App) {
  // 全局注册组件
  components.forEach((component: Component) => {
    app.component(component.name, component);
  });
  // 全局注册插件
  plugins.forEach(plugin => {
    app.use(plugin);
  });
}
