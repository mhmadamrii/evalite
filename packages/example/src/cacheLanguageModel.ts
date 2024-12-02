import {
  experimental_wrapLanguageModel,
  type LanguageModelV1,
  type LanguageModelV1CallOptions,
} from "ai";
import { createHash } from "node:crypto";
import { type Storage } from "unstorage";

const createKey = (params: LanguageModelV1CallOptions) => {
  return createHash("sha256").update(JSON.stringify(params)).digest("hex");
};

const createResultFromCachedObject = (
  obj: any
): Awaited<ReturnType<LanguageModelV1["doGenerate"]>> => {
  if (obj?.response?.timestamp) {
    obj.response.timestamp = new Date(obj.response.timestamp);
  }
  return obj as any;
};

export const cacheLanguageModel = (
  model: LanguageModelV1,
  storage: Storage
) => {
  return experimental_wrapLanguageModel({
    model,
    middleware: {
      wrapGenerate: async (opts) => {
        const key = createKey(opts.params);

        const resultFromCache = await storage.get(key);

        if (resultFromCache && typeof resultFromCache === "object") {
          return createResultFromCachedObject(resultFromCache);
        }
        const generated = await opts.doGenerate();

        await storage.set(key, JSON.stringify(generated));

        return generated;
      },
    },
  });
};
