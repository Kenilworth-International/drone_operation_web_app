import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery } from './nodeBackendConfig';

const BASE = '/api/fuel-generator-vouchers';

export const fuelGeneratorVoucherApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createFuelGeneratorVoucher: builder.mutation({
      queryFn: async (body) => {
        try {
          const result = await nodeBackendBaseQuery({ url: `${BASE}/create`, method: 'POST', body }, {}, {});
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['FuelGeneratorVouchers', 'FinancialCards', 'Transactions'],
    }),

    getPendingFuelGeneratorVouchers: builder.query({
      queryFn: async () => {
        try {
          const result = await nodeBackendBaseQuery({ url: `${BASE}/pending`, method: 'GET' }, {}, {});
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data || [] };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['FuelGeneratorVouchers'],
    }),

    getFuelGeneratorVoucherHistory: builder.query({
      queryFn: async (params = {}) => {
        try {
          const search = new URLSearchParams();
          if (params.status) search.set('status', params.status);
          if (params.settled !== undefined && params.settled !== null && params.settled !== '') {
            search.set('settled', String(params.settled));
          }
          const months = Array.isArray(params.months)
            ? params.months.filter(Boolean).slice(0, 3)
            : params.month
              ? [params.month]
              : [];
          if (months.length) search.set('months', months.join(','));
          const qs = search.toString();
          const result = await nodeBackendBaseQuery(
            { url: `${BASE}/history${qs ? `?${qs}` : ''}`, method: 'GET' },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data || [] };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['FuelGeneratorVouchers'],
    }),

    getFuelGeneratorVoucherById: builder.query({
      queryFn: async (id) => {
        try {
          const result = await nodeBackendBaseQuery({ url: `${BASE}/${id}`, method: 'GET' }, {}, {});
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: (_r, _e, id) => [{ type: 'FuelGeneratorVouchers', id }],
    }),

    approveFuelGeneratorVoucher: builder.mutation({
      queryFn: async (id) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: `${BASE}/${id}/approve`, method: 'POST', body: {} },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['FuelGeneratorVouchers', 'FinancialCards', 'Transactions'],
    }),

    declineFuelGeneratorVoucher: builder.mutation({
      queryFn: async ({ id, reason }) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: `${BASE}/${id}/decline`, method: 'POST', body: { reason } },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['FuelGeneratorVouchers', 'FinancialCards', 'Transactions'],
    }),

    declineFuelGeneratorVoucherByFinance: builder.mutation({
      queryFn: async ({ transaction_ids: transactionIds, reason }) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: `${BASE}/finance-decline`, method: 'POST', body: { transaction_ids: transactionIds, reason } },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['FuelGeneratorVouchers', 'FinancialCards', 'Transactions'],
    }),

    recordFuelGeneratorPhysicalApproval: builder.mutation({
      queryFn: async ({ id, ...body }) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: `${BASE}/${id}/physical-approval`, method: 'POST', body },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['FuelGeneratorVouchers', 'FinancialCards', 'Transactions'],
    }),

    settleFuelGeneratorVoucher: builder.mutation({
      queryFn: async ({ id, ...body }) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: `${BASE}/${id}/settle`, method: 'POST', body },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: ['FuelGeneratorVouchers', 'FinancialCards', 'FinancialCardTransactions', 'Transactions'],
    }),
  }),
});

export const {
  useCreateFuelGeneratorVoucherMutation,
  useGetPendingFuelGeneratorVouchersQuery,
  useGetFuelGeneratorVoucherHistoryQuery,
  useGetFuelGeneratorVoucherByIdQuery,
  useApproveFuelGeneratorVoucherMutation,
  useDeclineFuelGeneratorVoucherMutation,
  useDeclineFuelGeneratorVoucherByFinanceMutation,
  useRecordFuelGeneratorPhysicalApprovalMutation,
  useSettleFuelGeneratorVoucherMutation,
} = fuelGeneratorVoucherApi;
