import { defineFakeRoute } from "vite-plugin-fake-server/client";
import { version } from "../package.json";

// 版本与 package.json 单源：dev 态「检查更新」请求 /version.json 的兜底。
// 注意：mock 由 fake-server 在 **Node 侧**执行，`__APP_INFO__` 是应用构建期的 define
// （Node 侧不存在，用它会让 dev server 在首个请求时崩掉），只能从包清单读版本。
export default defineFakeRoute([
  {
    url: "/version.json",
    method: "get",
    response: () => {
      return { version, external: "" };
    }
  }
]);
