import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery } from './nodeBackendConfig';

export const voucherPaymentsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getVoucherPayments: builder.query({
      queryFn: async ({ voucherType = 'all', paymentStatus = 'all', month = '' } = {}) => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: '/api/voucher-payments/list',
              method: 'POST',
              body: { voucher_type: voucherType, payment_status: paymentStatus, month: month || null },
            },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || { vouchers: [], payment_columns_ready: true } };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['VoucherPayments'],
    }),

    getVoucherPaymentDetail: builder.query({
      queryFn: async (id) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: `/api/voucher-payments/${id}`, method: 'GET' },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: (_r, _e, id) => [{ type: 'VoucherPayments', id }],
    }),

    markVoucherPaid: builder.mutation({
      queryFn: async ({ id, ...body }) => {
        try {
          const result = await nodeBackendBaseQuery(
            { url: `/api/voucher-payments/${id}/mark-paid`, method: 'POST', body },
            {},
            {}
          );
          if (result.error) return { error: result.error };
          return { data: result.data?.data || result.data };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      invalidatesTags: [
        'VoucherPayments',
        'FuelTransportVouchers',
        'FuelGeneratorVouchers',
        'FinancialCards',
        'FinancialCardTransactions',
        'Transactions',
      ],
    }),
  }),
});

export const {
  useGetVoucherPaymentsQuery,
  useLazyGetVoucherPaymentDetailQuery,
  useMarkVoucherPaidMutation,
} = voucherPaymentsApi;
