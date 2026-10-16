import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery, getNodeBackendUrl, getToken } from './nodeBackendConfig';

export const plantationInvoiceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getInvoiceOrganizations: builder.query({
      queryFn: async ({ includeInactive } = {}) => {
        const qs = includeInactive ? '?include_inactive=1' : '';
        const result = await nodeBackendBaseQuery(
          { url: `/api/plantation-invoices/organizations${qs}`, method: 'GET' },
          {},
          {}
        );
        if (result.error) return result;
        return { data: result.data?.data || [] };
      },
      providesTags: ['PlantationInvoices'],
    }),
    saveInvoiceOrganization: builder.mutation({
      queryFn: async (body) => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/plantation-invoices/organizations/save', method: 'POST', body },
          {},
          {}
        );
        if (result.error) return result;
        return { data: result.data?.data || null };
      },
      invalidatesTags: ['PlantationInvoices'],
    }),
    getInvoiceTaxTypes: builder.query({
      queryFn: async ({ includeInactive } = {}) => {
        const qs = includeInactive ? '?include_inactive=1' : '';
        const result = await nodeBackendBaseQuery(
          { url: `/api/plantation-invoices/tax-types${qs}`, method: 'GET' },
          {},
          {}
        );
        if (result.error) return result;
        return { data: result.data?.data || [] };
      },
      providesTags: ['PlantationInvoices'],
    }),
    saveInvoiceTaxType: builder.mutation({
      queryFn: async (body) => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/plantation-invoices/tax-types/save', method: 'POST', body },
          {},
          {}
        );
        if (result.error) return result;
        return { data: result.data?.data || null };
      },
      invalidatesTags: ['PlantationInvoices'],
    }),
    getInvoiceMonthlyFuelPrice: builder.query({
      queryFn: async ({ billing_month, period_end } = {}) => {
        const qs = new URLSearchParams();
        if (billing_month) qs.set('billing_month', String(billing_month));
        if (period_end) qs.set('period_end', String(period_end));
        const suffix = qs.toString() ? `?${qs.toString()}` : '';
        const result = await nodeBackendBaseQuery(
          { url: `/api/plantation-invoices/fuel-price${suffix}`, method: 'GET' },
          {},
          {}
        );
        if (result.error) return result;
        return { data: result.data?.data || null };
      },
    }),
    saveInvoiceMonthlyFuelPrice: builder.mutation({
      queryFn: async (body) => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/plantation-invoices/fuel-price/save', method: 'POST', body },
          {},
          {}
        );
        if (result.error) return result;
        return { data: result.data?.data || null };
      },
    }),
    getPlantationInvoiceDraft: builder.mutation({
      queryFn: async (body) => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/plantation-invoices/draft', method: 'POST', body },
          {},
          {}
        );
        if (result.error) return result;
        return { data: result.data?.data || null };
      },
    }),
    getPlantationPreInvoiceDraft: builder.mutation({
      queryFn: async (body) => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/plantation-invoices/pre-draft', method: 'POST', body },
          {},
          {}
        );
        if (result.error) return result;
        return { data: result.data?.data || null };
      },
    }),
    getPlantationFinalInvoiceDraft: builder.mutation({
      queryFn: async (body) => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/plantation-invoices/final-draft', method: 'POST', body },
          {},
          {}
        );
        if (result.error) return result;
        return { data: result.data?.data || null };
      },
    }),
    createPlantationInvoice: builder.mutation({
      queryFn: async (body) => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/plantation-invoices', method: 'POST', body },
          {},
          {}
        );
        if (result.error) return result;
        return { data: result.data?.data || null };
      },
      invalidatesTags: ['PlantationInvoices', 'PlantationInvoicePayments'],
    }),
    listPlantationInvoices: builder.query({
      queryFn: async ({
        plantation_id,
        invoice_type,
        status,
        year,
        month,
        include_voided,
        limit,
      } = {}) => {
        const qs = new URLSearchParams();
        if (plantation_id) qs.set('plantation_id', String(plantation_id));
        if (invoice_type) qs.set('invoice_type', String(invoice_type));
        if (status) qs.set('status', String(status));
        if (year) qs.set('year', String(year));
        if (month) qs.set('month', String(month));
        if (include_voided) qs.set('include_voided', '1');
        if (limit) qs.set('limit', String(limit));
        const suffix = qs.toString() ? `?${qs.toString()}` : '';
        const result = await nodeBackendBaseQuery(
          { url: `/api/plantation-invoices${suffix}`, method: 'GET' },
          {},
          {}
        );
        if (result.error) return result;
        return { data: result.data?.data || [] };
      },
      providesTags: ['PlantationInvoices'],
    }),
    voidPlantationInvoice: builder.mutation({
      queryFn: async ({ id, reason } = {}) => {
        const result = await nodeBackendBaseQuery(
          {
            url: `/api/plantation-invoices/${id}/void`,
            method: 'POST',
            body: { reason: reason || undefined },
          },
          {},
          {}
        );
        if (result.error) return result;
        return { data: result.data?.data || null };
      },
      invalidatesTags: ['PlantationInvoices', 'PlantationInvoicePayments'],
    }),
    getPlantationInvoiceById: builder.query({
      queryFn: async (id) => {
        const result = await nodeBackendBaseQuery(
          { url: `/api/plantation-invoices/${id}`, method: 'GET' },
          {},
          {}
        );
        if (result.error) return result;
        return { data: result.data?.data || null };
      },
      providesTags: ['PlantationInvoices'],
    }),
    listPlantationInvoicePayments: builder.query({
      queryFn: async (invoiceId) => {
        const result = await nodeBackendBaseQuery(
          { url: `/api/plantation-invoices/${invoiceId}/payments`, method: 'GET' },
          {},
          {}
        );
        if (result.error) return result;
        return { data: result.data?.data || [] };
      },
      providesTags: (_r, _e, invoiceId) => [
        { type: 'PlantationInvoicePayments', id: invoiceId },
        'PlantationInvoicePayments',
      ],
    }),
    addPlantationInvoicePayment: builder.mutation({
      queryFn: async ({ invoiceId, payment_receipt, ...fields }) => {
        const formData = new FormData();
        Object.entries(fields).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            formData.append(key, String(value));
          }
        });
        if (payment_receipt) formData.append('payment_receipt', payment_receipt);

        try {
          const response = await fetch(
            `${getNodeBackendUrl()}/api/plantation-invoices/${invoiceId}/payments`,
            {
              method: 'POST',
              headers: { Authorization: `Bearer ${getToken()}` },
              body: formData,
            }
          );
          const raw = await response.text();
          let data;
          try {
            data = raw ? JSON.parse(raw) : {};
          } catch {
            data = { message: raw || 'Upload failed' };
          }
          if (!response.ok) return { error: { status: response.status, data } };
          return { data: data?.data || data };
        } catch (e) {
          return {
            error: {
              status: 'FETCH_ERROR',
              data: { message: e?.message || 'Network error while saving payment' },
            },
          };
        }
      },
      invalidatesTags: (_r, _e, arg) => [
        'PlantationInvoices',
        'PlantationInvoicePayments',
        { type: 'PlantationInvoicePayments', id: arg.invoiceId },
      ],
    }),
    voidPlantationInvoicePayment: builder.mutation({
      queryFn: async (paymentId) => {
        const result = await nodeBackendBaseQuery(
          { url: `/api/plantation-invoices/payments/${paymentId}/void`, method: 'POST', body: {} },
          {},
          {}
        );
        if (result.error) return result;
        return { data: result.data?.data || null };
      },
      invalidatesTags: ['PlantationInvoices', 'PlantationInvoicePayments'],
    }),
  }),
});

export const {
  useGetInvoiceOrganizationsQuery,
  useSaveInvoiceOrganizationMutation,
  useGetInvoiceTaxTypesQuery,
  useSaveInvoiceTaxTypeMutation,
  useLazyGetInvoiceMonthlyFuelPriceQuery,
  useSaveInvoiceMonthlyFuelPriceMutation,
  useGetPlantationInvoiceDraftMutation,
  useGetPlantationPreInvoiceDraftMutation,
  useGetPlantationFinalInvoiceDraftMutation,
  useCreatePlantationInvoiceMutation,
  useListPlantationInvoicesQuery,
  useLazyGetPlantationInvoiceByIdQuery,
  useVoidPlantationInvoiceMutation,
  useListPlantationInvoicePaymentsQuery,
  useAddPlantationInvoicePaymentMutation,
  useVoidPlantationInvoicePaymentMutation,
} = plantationInvoiceApi;
