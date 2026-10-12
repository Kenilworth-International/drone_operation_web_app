import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery } from './nodeBackendConfig';

export const appFeaturesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAppFeatures: builder.query({
      queryFn: async () => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: '/api/app-features/list', method: 'POST', body: {} },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || [] };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['AppFeatures'],
    }),

    updateAppFeature: builder.mutation({
      queryFn: async (data) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: '/api/app-features/update', method: 'POST', body: data },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || null };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['AppFeatures'],
    }),
  }),
});

export const { useGetAppFeaturesQuery, useUpdateAppFeatureMutation } = appFeaturesApi;
