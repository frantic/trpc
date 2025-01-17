import {
  AnyRouter,
  assertNotBrowser,
  ClientDataTransformerOptions,
  inferHandlerInput,
  inferProcedureOutput,
  inferRouterContext,
} from '@trpc/server';
import { InfiniteData, QueryClient } from 'react-query';
import {
  dehydrate,
  DehydratedState,
  DehydrateOptions,
} from 'react-query/hydration';
import {
  CACHE_KEY_INFINITE_QUERY,
  CACHE_KEY_QUERY,
} from './internals/constants';
import { getCacheKey } from './internals/getCacheKey';
type QueryClientConfig = ConstructorParameters<typeof QueryClient>[0];

assertNotBrowser();

export interface CreateSSGHelpersOptions<TRouter extends AnyRouter> {
  router: TRouter;
  ctx: inferRouterContext<TRouter>;
  transformer?: ClientDataTransformerOptions;
  queryClientConfig?: QueryClientConfig;
}

/**
 * Create functions you can use for server-side rendering / static generation
 */
export function createSSGHelpers<TRouter extends AnyRouter>({
  router,
  transformer,
  ctx,
  queryClientConfig,
}: CreateSSGHelpersOptions<TRouter>) {
  type TQueries = TRouter['_def']['queries'];
  const queryClient = new QueryClient(queryClientConfig);

  const caller = router.createCaller(ctx) as ReturnType<
    TRouter['createCaller']
  >;
  const prefetchQuery = async <
    TPath extends keyof TQueries & string,
    TProcedure extends TQueries[TPath],
  >(
    ...pathAndInput: [path: TPath, ...args: inferHandlerInput<TProcedure>]
  ) => {
    const [path, input] = pathAndInput;
    const cacheKey = [path, input ?? null, CACHE_KEY_QUERY];

    return queryClient.prefetchQuery(cacheKey, async () => {
      const data = await caller.query(...pathAndInput);

      return data;
    });
  };

  const prefetchInfiniteQuery = async <
    TPath extends keyof TQueries & string,
    TProcedure extends TQueries[TPath],
  >(
    ...pathAndInput: [path: TPath, ...args: inferHandlerInput<TProcedure>]
  ) => {
    const cacheKey = getCacheKey(pathAndInput, CACHE_KEY_INFINITE_QUERY);

    return queryClient.prefetchInfiniteQuery(cacheKey, async () => {
      const data = await caller.query(...pathAndInput);

      return data;
    });
  };

  const fetchQuery = async <
    TPath extends keyof TQueries & string,
    TProcedure extends TQueries[TPath],
    TOutput extends inferProcedureOutput<TProcedure>,
  >(
    ...pathAndInput: [path: TPath, ...args: inferHandlerInput<TProcedure>]
  ): Promise<TOutput> => {
    const [path, input] = pathAndInput;
    const cacheKey = [path, input ?? null, CACHE_KEY_QUERY];

    return queryClient.fetchQuery(cacheKey, async () => {
      const data = await caller.query(...pathAndInput);

      return data;
    });
  };

  const fetchInfiniteQuery = async <
    TPath extends keyof TQueries & string,
    TProcedure extends TQueries[TPath],
    TOutput extends inferProcedureOutput<TProcedure>,
  >(
    ...pathAndInput: [path: TPath, ...args: inferHandlerInput<TProcedure>]
  ): Promise<InfiniteData<TOutput>> => {
    const cacheKey = getCacheKey(pathAndInput, CACHE_KEY_INFINITE_QUERY);

    return queryClient.fetchInfiniteQuery(cacheKey, async () => {
      const data = await caller.query(...pathAndInput);

      return data;
    });
  };

  function _dehydrate(
    opts: DehydrateOptions = {
      shouldDehydrateQuery() {
        // makes sure to serialize errors
        return true;
      },
    },
  ): DehydratedState {
    const serialize = transformer
      ? ('input' in transformer ? transformer.input : transformer).serialize
      : (obj: unknown) => obj;

    return serialize(dehydrate(queryClient, opts));
  }

  return {
    prefetchQuery,
    prefetchInfiniteQuery,
    fetchQuery,
    fetchInfiniteQuery,
    dehydrate: _dehydrate,
    queryClient,
  };
}
