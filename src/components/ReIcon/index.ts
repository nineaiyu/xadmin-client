import iconifyIconOffline from "./src/iconifyIconOffline";
import iconSelect from "./src/Select.vue";
import fontIcon from "./src/iconfont";

/** 本地图标组件（离线：图标随包注册或按 set 懒加载本地图标集，不访问在线 API） */
const IconifyIconOffline = iconifyIconOffline;
/** `IconSelect`图标选择器组件 */
const IconSelect = iconSelect;
/** `iconfont`组件 */
const FontIcon = fontIcon;

export { IconifyIconOffline, IconSelect, FontIcon };
