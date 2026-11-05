import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery } from './nodeBackendConfig';

export const fuelApprovalsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPendingFuelApprovals: builder.query({
      queryFn: async () => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: '/api/fuel-approvals/pending', method: 'GET' },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          const rows = result.data?.data || result.data || [];
          return { data: rows };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['FuelApprovals'],
    }),

    getFuelApprovalsHistory: builder.query({
      queryFn: async () => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: '/api/fuel-approvals/history', method: 'GET' },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          const rows = result.data?.data || result.data || [];
          return { data: rows };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['FuelApprovals'],
    }),

    getFuelApprovalsReport: builder.query({
      queryFn: async (params = {}) => {
        try {
          const qs = new URLSearchParams();
          Object.entries(params || {}).forEach(([key, value]) => {
            if (value == null || value === '') return;
            if (key !== 'fuel_source' && value === 'all') return;
            qs.set(key, String(value));
          });
          const q = qs.toString();
          const result = await nodeBackendBaseQuery(
            {
              url: `/api/fuel-approvals/report${q ? `?${q}` : ''}`,
              method: 'GET',
            },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          const payload = result.data?.data || result.data || {};
          return {
            data: {
              filters: payload.filters || {},
              summary: payload.summary || {},
              rows: Array.isArray(payload.rows) ? payload.rows : [],
            },
          };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['FuelApprovals', 'GeneratorFuelApprovals'],
    }),

    decideFuelApproval: builder.mutation({
      queryFn: async (body) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: '/api/fuel-approvals/decide', method: 'POST', body },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['FuelApprovals', 'FinancialCards', 'FinancialCardTransactions'],
    }),
  }),
});

export const {
  useGetPendingFuelApprovalsQuery,
  useGetFuelApprovalsHistoryQuery,
  useGetFuelApprovalsReportQuery,
  useDecideFuelApprovalMutation,
} = fuelApprovalsApi;
