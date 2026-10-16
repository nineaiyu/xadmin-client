// 这里存放本地图标，在 src/layout/index.vue 文件中加载，避免在首启动加载
import { getSvgInfo } from "@pureadmin/utils";
import { addIcon } from "@iconify/vue/dist/offline";

import { markIconAvailable } from "./iconRegistry";

// https://icon-sets.iconify.design/ep/?keyword=ep
import EpMenu from "~icons/ep/menu?raw";
import EpEdit from "~icons/ep/edit?raw";
import EpGuide from "~icons/ep/guide?raw";
import EpSetUp from "~icons/ep/set-up?raw";
import EpMonitor from "~icons/ep/monitor?raw";
import EpLollipop from "~icons/ep/lollipop?raw";
import EpHistogram from "~icons/ep/histogram?raw";
import EpHomeFilled from "~icons/ep/home-filled?raw";
// —— 服务端菜单元数据在用（loadjson/menumeta.json，形如 "ep:refrigerator"）——
import EpAlarmClock from "~icons/ep/alarm-clock?raw";
import EpAvatar from "~icons/ep/avatar?raw";
import EpCalendar from "~icons/ep/calendar?raw";
import EpCellphone from "~icons/ep/cellphone?raw";
import EpChatDotRound from "~icons/ep/chat-dot-round?raw";
import EpChatLineSquare from "~icons/ep/chat-line-square?raw";
import EpCoin from "~icons/ep/coin?raw";
import EpCollection from "~icons/ep/collection?raw";
import EpConnection from "~icons/ep/connection?raw";
import EpCopyDocument from "~icons/ep/copy-document?raw";
import EpDataAnalysis from "~icons/ep/data-analysis?raw";
import EpDataLine from "~icons/ep/data-line?raw";
import EpDocument from "~icons/ep/document?raw";
import EpDocumentAdd from "~icons/ep/document-add?raw";
import EpDocumentChecked from "~icons/ep/document-checked?raw";
import EpDownload from "~icons/ep/download?raw";
import EpEditPen from "~icons/ep/edit-pen?raw";
import EpFiles from "~icons/ep/files?raw";
import EpGrid from "~icons/ep/grid?raw";
import EpInfoFilled from "~icons/ep/info-filled?raw";
import EpIphone from "~icons/ep/iphone?raw";
import EpLink from "~icons/ep/link?raw";
import EpList from "~icons/ep/list?raw";
import EpLock from "~icons/ep/lock?raw";
import EpMessage from "~icons/ep/message?raw";
import EpMoney from "~icons/ep/money?raw";
import EpNotebook from "~icons/ep/notebook?raw";
import EpNotification from "~icons/ep/notification?raw";
import EpOfficeBuilding from "~icons/ep/office-building?raw";
import EpRefrigerator from "~icons/ep/refrigerator?raw";
import EpScaleToOriginal from "~icons/ep/scale-to-original?raw";
import EpSetting from "~icons/ep/setting?raw";
import EpStamp from "~icons/ep/stamp?raw";
import EpTickets from "~icons/ep/tickets?raw";
import EpTimer from "~icons/ep/timer?raw";
import EpUser from "~icons/ep/user?raw";
import EpView from "~icons/ep/view?raw";
// —— 空态组件（ReEmpty）默认图标：本地图标集懒加载不会回填已挂载实例，必须随包注册 ——
import EpBox from "~icons/ep/box?raw";

// https://icon-sets.iconify.design/ri/?keyword=ri
import RiMindMap from "~icons/ri/mind-map?raw";
import RiAdminFill from "~icons/ri/admin-fill?raw";
import RiTableLine from "~icons/ri/table-line?raw";
import RiLinksFill from "~icons/ri/links-fill?raw";
import RiAdminLine from "~icons/ri/admin-line?raw";
import RiListCheck from "~icons/ri/list-check?raw";
import RiSearchLine from "~icons/ri/search-line?raw";
import RiWindowLine from "~icons/ri/window-line?raw";
import RiUbuntuFill from "~icons/ri/ubuntu-fill?raw";
import RiHistoryFill from "~icons/ri/history-fill?raw";
import RiEditBoxLine from "~icons/ri/edit-box-line?raw";
import RiCodeBoxLine from "~icons/ri/code-box-line?raw";
import RiArtboardLine from "~icons/ri/artboard-line?raw";
import RiMarkdownLine from "~icons/ri/markdown-line?raw";
import RiFileInfoLine from "~icons/ri/file-info-line?raw";
import RiBankCardLine from "~icons/ri/bank-card-line?raw";
import RiFilePpt2Line from "~icons/ri/file-ppt-2-line?raw";
import RiGitBranchLine from "~icons/ri/git-branch-line?raw";
import RiSettings3Line from "~icons/ri/settings-3-line?raw";
import RiUserVoiceLine from "~icons/ri/user-voice-line?raw";
import RiBookmark2Line from "~icons/ri/bookmark-2-line?raw";
import RiFileSearchLine from "~icons/ri/file-search-line?raw";
import RiChatSearchLine from "~icons/ri/chat-search-line?raw";
import RiInformationLine from "~icons/ri/information-line?raw";
import RiTerminalWindowLine from "~icons/ri/terminal-window-line?raw";
import RiCheckboxCircleLine from "~icons/ri/checkbox-circle-line?raw";
import RiBarChartHorizontalLine from "~icons/ri/bar-chart-horizontal-line?raw";
// —— 服务端菜单元数据在用（同上，ri 集）——
import RiContactsLine from "~icons/ri/contacts-line?raw";
import RiFileCloudLine from "~icons/ri/file-cloud-line?raw";
import RiGroupLine from "~icons/ri/group-line?raw";
import RiListSettingsFill from "~icons/ri/list-settings-fill?raw";

const icons = [
  // Element Plus Icon: https://github.com/element-plus/element-plus-icons
  ["ep/menu", EpMenu],
  ["ep/edit", EpEdit],
  ["ep/guide", EpGuide],
  ["ep/set-up", EpSetUp],
  ["ep/monitor", EpMonitor],
  ["ep/lollipop", EpLollipop],
  ["ep/histogram", EpHistogram],
  ["ep/home-filled", EpHomeFilled],
  // 空态组件（ReEmpty）默认图标
  ["ep/box", EpBox],
  // Remix Icon: https://github.com/Remix-Design/RemixIcon
  ["ri/mind-map", RiMindMap],
  ["ri/admin-fill", RiAdminFill],
  ["ri/table-line", RiTableLine],
  ["ri/links-fill", RiLinksFill],
  ["ri/admin-line", RiAdminLine],
  ["ri/list-check", RiListCheck],
  ["ri/search-line", RiSearchLine],
  ["ri/window-line", RiWindowLine],
  ["ri/ubuntu-fill", RiUbuntuFill],
  ["ri/history-fill", RiHistoryFill],
  ["ri/edit-box-line", RiEditBoxLine],
  ["ri/code-box-line", RiCodeBoxLine],
  ["ri/artboard-line", RiArtboardLine],
  ["ri/markdown-line", RiMarkdownLine],
  ["ri/file-info-line", RiFileInfoLine],
  ["ri/bank-card-line", RiBankCardLine],
  ["ri/file-ppt-2-line", RiFilePpt2Line],
  ["ri/git-branch-line", RiGitBranchLine],
  ["ri/settings-3-line", RiSettings3Line],
  ["ri/user-voice-line", RiUserVoiceLine],
  ["ri/bookmark-2-line", RiBookmark2Line],
  ["ri/file-search-line", RiFileSearchLine],
  ["ri/chat-search-line", RiChatSearchLine],
  ["ri/information-line", RiInformationLine],
  ["ri/terminal-window-line", RiTerminalWindowLine],
  ["ri/checkbox-circle-line", RiCheckboxCircleLine],
  ["ri/bar-chart-horizontal-line", RiBarChartHorizontalLine],
  // —— 服务端菜单元数据在用（loadjson/menumeta.json）——
  ["ep/alarm-clock", EpAlarmClock],
  ["ep/avatar", EpAvatar],
  ["ep/calendar", EpCalendar],
  ["ep/cellphone", EpCellphone],
  ["ep/chat-dot-round", EpChatDotRound],
  ["ep/chat-line-square", EpChatLineSquare],
  ["ep/coin", EpCoin],
  ["ep/collection", EpCollection],
  ["ep/connection", EpConnection],
  ["ep/copy-document", EpCopyDocument],
  ["ep/data-analysis", EpDataAnalysis],
  ["ep/data-line", EpDataLine],
  ["ep/document", EpDocument],
  ["ep/document-add", EpDocumentAdd],
  ["ep/document-checked", EpDocumentChecked],
  ["ep/download", EpDownload],
  ["ep/edit-pen", EpEditPen],
  ["ep/files", EpFiles],
  ["ep/grid", EpGrid],
  ["ep/info-filled", EpInfoFilled],
  ["ep/iphone", EpIphone],
  ["ep/link", EpLink],
  ["ep/list", EpList],
  ["ep/lock", EpLock],
  ["ep/message", EpMessage],
  ["ep/money", EpMoney],
  ["ep/notebook", EpNotebook],
  ["ep/notification", EpNotification],
  ["ep/office-building", EpOfficeBuilding],
  ["ep/refrigerator", EpRefrigerator],
  ["ep/scale-to-original", EpScaleToOriginal],
  ["ep/setting", EpSetting],
  ["ep/stamp", EpStamp],
  ["ep/tickets", EpTickets],
  ["ep/timer", EpTimer],
  ["ep/user", EpUser],
  ["ep/view", EpView],
  // —— 服务端菜单元数据在用（同上，ri 集）——
  ["ri/contacts-line", RiContactsLine],
  ["ri/file-cloud-line", RiFileCloudLine],
  ["ri/group-line", RiGroupLine],
  ["ri/list-settings-fill", RiListSettingsFill]
];

// 本地菜单图标：服务端在菜单 meta 的 icon 字段返回图标字符串，前端在此注册后即可渲染。
// **双形态注册**：代码内用斜杠名（`useRenderIcon("ri/search-line")`），服务端元数据用
// 冒号名（`loadjson/menumeta.json` 的 `"ep:refrigerator"`）——同一份数据注册两个键，
// 避免「种子换形态就静默不渲染」。未随包内置的图标由 iconRegistry 按 set 前缀懒加载
// 本地图标集（同源 chunk），全程不访问在线图标 API。
icons.forEach(([name, icon]) => {
  const data = getSvgInfo(icon as string);
  const slashed = name as string;
  const coloned = slashed.replace("/", ":");
  addIcon(slashed, data);
  addIcon(coloned, data);
  markIconAvailable(slashed, coloned);
});
