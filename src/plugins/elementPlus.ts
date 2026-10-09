// 按需注册 element-plus：只有本仓库 src 中实际用到的组件才会进包。
//
// 维护约定（重要）：
// - 组件级按需引入不等于「自动按需」——显式 import 并全局注册的组件，打包器无法摇掉，
//   注册多少就进多少。故清单必须与 src 中的真实用法保持一致。
// - 新增用法（模板 <el-…> 或运行时 import）时，须同步在此登记，否则运行时报
//   "Failed to resolve component: el-<name>"（Vue 的 resolveAsset 会按
//   el-a-b → elAB → ElAB 逐级回退查找全局注册名）。
//   注：`src/plugins/__tests__/elementPlus.spec.ts` 会扫描 src 中的用法并与本文件比对。
// - 清理未使用组件时按这两条线索核对：
//     grep -rhoE "(<el-|[\"'\`]el-)[a-z0-9-]+" src --include="*.vue" --include="*.ts" --include="*.tsx"
//     grep -rh -B12 'from "element-plus"' src --include="*.vue" --include="*.ts" --include="*.tsx"
//   子组件（如 ElOption/ElTableColumn/ElDescriptionsItem）虽不单独出现在模板之外，
//   也必须随父组件保留。
//
// 分档策略（首屏体积治理）：
// - `components`（急加载）：应用外壳（App / 布局 / 登录页）渲染即需要的组件，
//   静态 import、随主包一起到达，保证外壳首帧即可绘制。
// - `lazyComponents`（按需）：只出现在业务页面里的组件，全局注册为异步组件——
//   模板中的 <el-*> 仍按同名解析，但组件代码（及 date-picker→dayjs、
//   cascader→cascader-panel 等内部依赖）不再进入首屏闭包，首次渲染时按需拉取。
//   同一 EP 模块被多个名字复用时（如 container 导出 ElAside/ElMain）只发一次请求。
//
// 例外（必须与外壳同为急加载）：**父组件在渲染期扫描默认插槽 vnode 判定子组件的
// 那一类**。异步组件在插槽里是 AsyncComponentWrapper，父组件按 `type.name` 找不到
// 真实子组件——`el-descriptions` 因此会把描述项全部漏掉，表格渲染成空（实测：
// 成员详情 / 提交详情 / 审批详情抽屉内的资料区全空，见 elementPlus.spec.ts 守护）。
// 新增此类组件（子项被父组件按类型名收集）时，父子必须同档同步注册。
//
// 急加载档一律走「子路径」而非 `element-plus` 桶文件：桶文件的 `es/index.mjs`
// 是单一超模块，import 任一导出即把全部 `components/*` 拉入同一图，
// 会使按需块被静态依赖（打包产物中表现为按需块仍被 modulepreload）。
import type { App, Component } from "vue";
import { defineAsyncComponent } from "vue";
import { ElAlert } from "element-plus/es/components/alert/index.mjs";
import { ElContainer } from "element-plus/es/components/container/index.mjs";
// descriptions 父子必须同步注册（不能走异步档，理由见上方「例外」：父组件扫描插槽
// vnode 的 type.name 收集子项，异步包装后匹配不到 → 描述列表渲染成空表）
import {
  ElDescriptions,
  ElDescriptionsItem
} from "element-plus/es/components/descriptions/index.mjs";
import { ElDrawer } from "element-plus/es/components/drawer/index.mjs";
import { ElEmpty } from "element-plus/es/components/empty/index.mjs";
import { ElPagination } from "element-plus/es/components/pagination/index.mjs";
import { ElPopconfirm } from "element-plus/es/components/popconfirm/index.mjs";
import { ElPopover } from "element-plus/es/components/popover/index.mjs";
import { ElSpace } from "element-plus/es/components/space/index.mjs";
// 以下组件随外壳组件共享内部模块（collapse-transition ← menu、select ← pagination、
// progress ← notification、virtual-list ← tabs），必须与外壳同块急加载
import { ElCollapseTransition } from "element-plus/es/components/collapse-transition/index.mjs";
import { ElProgress } from "element-plus/es/components/progress/index.mjs";
import {
  ElOption,
  ElOptionGroup,
  ElSelect
} from "element-plus/es/components/select/index.mjs";
import { ElAvatar } from "element-plus/es/components/avatar/index.mjs";
import { ElBacktop } from "element-plus/es/components/backtop/index.mjs";
import { ElBadge } from "element-plus/es/components/badge/index.mjs";
import {
  ElBreadcrumb,
  ElBreadcrumbItem
} from "element-plus/es/components/breadcrumb/index.mjs";
import {
  ElButton,
  ElButtonGroup
} from "element-plus/es/components/button/index.mjs";
import { ElCheckbox } from "element-plus/es/components/checkbox/index.mjs";
import { ElCol } from "element-plus/es/components/col/index.mjs";
import { ElConfigProvider } from "element-plus/es/components/config-provider/index.mjs";
import { ElDialog } from "element-plus/es/components/dialog/index.mjs";
import { ElDivider } from "element-plus/es/components/divider/index.mjs";
import {
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu
} from "element-plus/es/components/dropdown/index.mjs";
import { ElForm, ElFormItem } from "element-plus/es/components/form/index.mjs";
import { ElIcon } from "element-plus/es/components/icon/index.mjs";
import { ElInput } from "element-plus/es/components/input/index.mjs";
import { ElInputNumber } from "element-plus/es/components/input-number/index.mjs";
import { ElLink } from "element-plus/es/components/link/index.mjs";
import {
  ElMenu,
  ElMenuItem,
  ElSubMenu
} from "element-plus/es/components/menu/index.mjs";
import {
  ElRadio,
  ElRadioButton,
  ElRadioGroup
} from "element-plus/es/components/radio/index.mjs";
import { ElResult } from "element-plus/es/components/result/index.mjs";
import { ElRow } from "element-plus/es/components/row/index.mjs";
import { ElScrollbar } from "element-plus/es/components/scrollbar/index.mjs";
import { ElSwitch } from "element-plus/es/components/switch/index.mjs";
import { ElTabs } from "element-plus/es/components/tabs/index.mjs";
import { ElTag } from "element-plus/es/components/tag/index.mjs";
import { ElText } from "element-plus/es/components/text/index.mjs";
import { ElTooltip } from "element-plus/es/components/tooltip/index.mjs";
// 插件（指令与全局属性对象）
import { ElInfiniteScroll } from "element-plus/es/components/infinite-scroll/index.mjs"; // v-infinite-scroll 指令
import { ElLoading } from "element-plus/es/components/loading/index.mjs"; // v-loading 指令
import { ElMessage } from "element-plus/es/components/message/index.mjs"; // $message 全局属性对象
import { ElMessageBox } from "element-plus/es/components/message-box/index.mjs"; // $msgbox、$alert、$confirm、$prompt 全局属性对象
import { ElNotification } from "element-plus/es/components/notification/index.mjs"; // $notify 全局属性对象

// 组件样式按需引入：替代全量 `element-plus/dist/index.css`（380KB）。
// 每个 style/css 内部已声明自身依赖（如 dialog → overlay、select → input/popper/tag），
// 无需手动补齐被依赖组件。清单须与注册的组件（含下方按需档）保持一致，
// 少了会「组件能跑但没样式」，多了则白付体积。
// 样式保留急加载：样式是按需链路的强依赖，缺失会直接表现为渲染错乱，
// 而 CSS 不计入首屏 JS 闭包门禁，故不做异步化（见 docs/perf-firstscreen.md）。
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
import "element-plus/es/components/collapse-transition/style/css";
import "element-plus/es/components/config-provider/style/css";
import "element-plus/es/components/container/style/css";
import "element-plus/es/components/date-picker/style/css";
import "element-plus/es/components/time-picker/style/css";
import "element-plus/es/components/time-select/style/css";
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
import "element-plus/es/components/statistic/style/css";
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
import "element-plus/es/components/tree-v2/style/css";
import "element-plus/es/components/upload/style/css";

/** 应用外壳组件：静态注册，随主包到达 */
const components = [
  ElAlert,
  ElAvatar,
  ElBacktop,
  ElBadge,
  ElBreadcrumb,
  ElBreadcrumbItem,
  ElButton,
  ElButtonGroup,
  ElCheckbox,
  ElCol,
  ElCollapseTransition,
  ElConfigProvider,
  ElContainer,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElDivider,
  ElDrawer,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElLink,
  ElMenu,
  ElMenuItem,
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
  ElSubMenu,
  ElSwitch,
  ElTabs,
  ElTag,
  ElText,
  ElTooltip
];

/**
 * 业务页面组件：全局注册为异步组件，模板中的 <el-*> / <ElXxx> 均可解析。
 * 键为全局注册名（PascalCase，与 EP 导出名一致），值为按需加载器。
 * 同一 EP 模块导出的多个组件（container/select/tabs/table/timeline/
 * splitter/checkbox/collapse/menu）共用一次动态 import，打包器会复用同一 chunk。
 */
const lazyComponents: Record<string, () => Promise<Component>> = {
  ElAside: () =>
    import("element-plus/es/components/container/index.mjs").then(
      m => m.ElAside
    ),
  ElAutocomplete: () =>
    import("element-plus/es/components/autocomplete/index.mjs").then(
      m => m.ElAutocomplete
    ),
  ElCard: () =>
    import("element-plus/es/components/card/index.mjs").then(m => m.ElCard),
  ElCascader: () =>
    import("element-plus/es/components/cascader/index.mjs").then(
      m => m.ElCascader
    ),
  ElCheckboxButton: () =>
    import("element-plus/es/components/checkbox/index.mjs").then(
      m => m.ElCheckboxButton
    ),
  ElCheckboxGroup: () =>
    import("element-plus/es/components/checkbox/index.mjs").then(
      m => m.ElCheckboxGroup
    ),
  ElCollapse: () =>
    import("element-plus/es/components/collapse/index.mjs").then(
      m => m.ElCollapse
    ),
  ElCollapseItem: () =>
    import("element-plus/es/components/collapse/index.mjs").then(
      m => m.ElCollapseItem
    ),
  ElColorPicker: () =>
    import("element-plus/es/components/color-picker/index.mjs").then(
      m => m.ElColorPicker
    ),
  ElDatePicker: () =>
    import("element-plus/es/components/date-picker/index.mjs").then(
      m => m.ElDatePicker
    ),
  ElFooter: () =>
    import("element-plus/es/components/container/index.mjs").then(
      m => m.ElFooter
    ),
  ElHeader: () =>
    import("element-plus/es/components/container/index.mjs").then(
      m => m.ElHeader
    ),
  ElImage: () =>
    import("element-plus/es/components/image/index.mjs").then(m => m.ElImage),
  ElMain: () =>
    import("element-plus/es/components/container/index.mjs").then(
      m => m.ElMain
    ),
  ElMenuItemGroup: () =>
    import("element-plus/es/components/menu/index.mjs").then(
      m => m.ElMenuItemGroup
    ),
  ElSplitter: () =>
    import("element-plus/es/components/splitter/index.mjs").then(
      m => m.ElSplitter
    ),
  ElSplitterPanel: () =>
    import("element-plus/es/components/splitter/index.mjs").then(
      m => m.ElSplitterPanel
    ),
  ElStatistic: () =>
    import("element-plus/es/components/statistic/index.mjs").then(
      m => m.ElStatistic
    ),
  ElTabPane: () =>
    import("element-plus/es/components/tabs/index.mjs").then(m => m.ElTabPane),
  ElTable: () =>
    import("element-plus/es/components/table/index.mjs").then(m => m.ElTable),
  ElTableColumn: () =>
    import("element-plus/es/components/table/index.mjs").then(
      m => m.ElTableColumn
    ),
  ElTimePicker: () =>
    import("element-plus/es/components/time-picker/index.mjs").then(
      m => m.ElTimePicker
    ),
  ElTimeSelect: () =>
    import("element-plus/es/components/time-select/index.mjs").then(
      m => m.ElTimeSelect
    ),
  ElTimeline: () =>
    import("element-plus/es/components/timeline/index.mjs").then(
      m => m.ElTimeline
    ),
  ElTimelineItem: () =>
    import("element-plus/es/components/timeline/index.mjs").then(
      m => m.ElTimelineItem
    ),
  ElTree: () =>
    import("element-plus/es/components/tree/index.mjs").then(m => m.ElTree),
  ElTreeSelect: () =>
    import("element-plus/es/components/tree-select/index.mjs").then(
      m => m.ElTreeSelect
    ),
  ElTreeV2: () =>
    import("element-plus/es/components/tree-v2/index.mjs").then(
      m => m.ElTreeV2
    ),
  ElUpload: () =>
    import("element-plus/es/components/upload/index.mjs").then(m => m.ElUpload)
};

const plugins = [
  ElInfiniteScroll,
  ElLoading,
  ElMessage,
  ElMessageBox,
  ElNotification
];

/** 按需注册`element-plus` */
export function useElementPlus(app: App) {
  // 全局注册组件（组件名运行时必然为字符串）
  components.forEach((component: Component) => {
    app.component(component.name as string, component);
  });
  // 全局注册异步组件（业务页面按需加载，不进入首屏闭包）
  Object.entries(lazyComponents).forEach(([name, loader]) => {
    app.component(name, defineAsyncComponent(loader));
  });
  // 全局注册插件
  plugins.forEach(plugin => {
    app.use(plugin);
  });
}
