import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery } from './nodeBackendConfig';

function pendingListLength(result) {
  if (result?.error) return 0;
  const body = result.data;
  if (Array.isArray(body?.data)) return body.data.length;
  if (Array.isArray(body)) return body.length;
  return 0;
}

export const strategicFinanceApprovalsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getStrategicFuelVoucherPendingCount: builder.query({
      queryFn: async () => {
        try {
          const [transportRes, generatorRes, maintenanceRes] = await Promise.all([
            nodeBackendBaseQuery(
              { url: '/api/fuel-transport-vouchers/pending', method: 'GET' },
              {},
              {}
            ),
            nodeBackendBaseQuery(
              { url: '/api/fuel-generator-vouchers/pending', method: 'GET' },
              {},
              {}
            ),
            nodeBackendBaseQuery(
              { url: '/api/maintenance-vouchers/pending', method: 'GET' },
              {},
              {}
            ),
          ]);
          const count =
            pendingListLength(transportRes) +
            pendingListLength(generatorRes) +
            pendingListLength(maintenanceRes);
          return { data: { count } };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: [
        'StrategicFinanceApprovals',
        'FuelTransportVouchers',
        'FuelGeneratorVouchers',
        'MaintenanceVouchers',
      ],
    }),
  }),
});

export const { useGetStrategicFuelVoucherPendingCountQuery } = strategicFinanceApprovalsApi;
