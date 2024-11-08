import { BaseApi } from "@/api/base";
import type { ChoicesResult } from "@/api/types";

class BookApi extends BaseApi {
  push = (pk: number | string) => {
    return this.request<ChoicesResult>(
      "post",
      {},
      {},
      `${this.baseApi}/${pk}/push`
    );
  };
}

const bookApi = new BookApi("/api/demo/book");
export { bookApi };
