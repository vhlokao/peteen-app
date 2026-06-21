import {
  QueryClient,
  defaultShouldDehydrateQuery,
  isServer,
} from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (isServer) {
    return makeQueryClient();
  }

  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }

  return browserQueryClient;
}

export const queryKeys = {
  all: ["peteen"] as const,
  identity: {
    all: () => [...queryKeys.all, "identity"] as const,
    session: () => [...queryKeys.identity.all(), "session"] as const,
  },
  trust: {
    all: () => [...queryKeys.all, "trust"] as const,
    profile: (id: string) => [...queryKeys.trust.all(), "profile", id] as const,
  },
  ranking: {
    all: () => [...queryKeys.all, "ranking"] as const,
    contextual: (params: Record<string, unknown>) =>
      [...queryKeys.ranking.all(), "contextual", params] as const,
  },
  crm: {
    all: () => [...queryKeys.all, "crm"] as const,
    clients: (professionalId: string) =>
      [...queryKeys.crm.all(), "clients", professionalId] as const,
  },
} as const;
