import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery } from './nodeBackendConfig';

export const generatorFuelApprovalsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPendingGeneratorFuelApprovals: builder.query({
      queryFn: async () => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: '/api/generator-fuel-approvals/pending', method: 'GET' },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data || [] };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['GeneratorFuelApprovals'],
    }),

    getGeneratorFuelApprovalsHistory: builder.query({
      queryFn: async () => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: '/api/generator-fuel-approvals/history', method: 'GET' },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data || [] };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['GeneratorFuelApprovals'],
    }),

    getGeneratorFuelReport: builder.query({
      queryFn: async (params = {}) => {
        try {
          const qs = new URLSearchParams();
          Object.entries(params || {}).forEach(([key, value]) => {
            if (value == null || value === '' || value === 'all') return;
            qs.set(key, String(value));
          });
          const q = qs.toString();
          const result = await nodeBackendBaseQuery(
            {
              url: `/api/generator-fuel-approvals/report${q ? `?${q}` : ''}`,
              method: 'GET',
            },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          const payload = result.data?.data || result.data || {};
          return {
            data: {
              summary: payload.summary || {},
              rows: Array.isArray(payload.rows) ? payload.rows : [],
            },
          };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['GeneratorFuelApprovals'],
    }),

    decideGeneratorFuelApproval: builder.mutation({
      queryFn: async (body) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: '/api/generator-fuel-approvals/decide', method: 'POST', body },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['GeneratorFuelApprovals', 'FinancialCards', 'FinancialCardTransactions'],
    }),
  }),
});

export const {
  useGetPendingGeneratorFuelApprovalsQuery,
  useGetGeneratorFuelApprovalsHistoryQuery,
  useGetGeneratorFuelReportQuery,
  useDecideGeneratorFuelApprovalMutation,
} = generatorFuelApprovalsApi;
