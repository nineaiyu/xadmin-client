import { BaseApi } from "@/api/base";

const bookApi = new BaseApi("/api/demo/book");
bookApi.update = bookApi.patch;
export { bookApi };
