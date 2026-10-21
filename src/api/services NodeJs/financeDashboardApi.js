import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery } from './nodeBackendConfig';

export const financeDashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getFinanceDashboardSummary: builder.query({
      queryFn: async (params = {}) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: '/api/finance-dashboard/summary',
              method: 'POST',
              body: { month: params.month || null },
            },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data || null };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['FinanceDashboard'],
    }),
    getFinanceDashboardDetail: builder.query({
      queryFn: async (params = {}) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: '/api/finance-dashboard/detail',
              method: 'POST',
              body: {
                month: params.month || null,
                metric: params.metric || null,
                category: params.category || null,
              },
            },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data || null };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['FinanceDashboard'],
    }),
  }),
});

export const {
  useGetFinanceDashboardSummaryQuery,
  useGetFinanceDashboardDetailQuery,
} = financeDashboardApi;
