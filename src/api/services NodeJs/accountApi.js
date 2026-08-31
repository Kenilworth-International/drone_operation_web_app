import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery } from './nodeBackendConfig';

export const accountApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    deactivateAccount: builder.mutation({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/account/deactivate', method: 'POST', body: {} },
          {},
          {}
        );
        return result;
      },
    }),
  }),
});

export const { useDeactivateAccountMutation } = accountApi;
