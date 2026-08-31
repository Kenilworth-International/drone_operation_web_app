import { baseApi } from '../baseApi';
import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { forceLogoutFromApi } from '../../utils/sessionUtils';
import { getNodeBackendUrl, getToken } from '../services NodeJs/nodeBackendUrl';

// Node.js Backend Base URL Configuration — use shared resolver (localhost / dev / prod)
const NODE_BACKEND_URL = getNodeBackendUrl();

// Custom base query for Node.js backend
const rawNodeBackendBaseQuery = fetchBaseQuery({
  baseUrl: NODE_BACKEND_URL,
  fetchFn: (input, init) =>
    fetch(input, {
      ...init,
      cache: 'no-store',
    }),
  prepareHeaders: (headers) => {
    const token = getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    headers.set('Content-Type', 'application/json');
    return headers;
  },
});

const nodeBackendBaseQuery = async (args, api, extraOptions) => {
  const result = await rawNodeBackendBaseQuery(args, api, extraOptions);
  if (result.error) {
    forceLogoutFromApi(api, result.error);
  }
  return result;
};

export const assetsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Drones
    getDrones: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/stock-assets/view_drone',
            method: 'POST',
            body: {},
          },
          {},
          {}
        );
        // Transform response to match expected structure
        if (result.error) {
          return { error: result.error };
        }
        // Backend returns { status: true, drones: [...] }
        // Return in format expected by assetsSlice thunk
        const drones = result.data?.drones || result.data?.data || [];
        return { data: { status: true, drones } };
      },
      providesTags: ['Assets', 'Drones'],
    }),

    createDrone: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/stock-assets/create_drone',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Assets', 'Drones'],
    }),

    updateDrone: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/stock-assets/update_drone',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Assets', 'Drones'],
    }),

    // Generators
    getGenerators: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/stock-assets/view_generator',
            method: 'POST',
            body: {},
          },
          {},
          {}
        );
        // Transform response to match expected structure
        if (result.error) {
          return { error: result.error };
        }
        // Backend returns { status: true, generators: [...] }
        // Return in format expected by assetsSlice thunk
        const generators = result.data?.generators || result.data?.data || [];
        return { data: { status: true, generators } };
      },
      providesTags: ['Assets', 'Generators'],
    }),

    createGenerator: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/stock-assets/create_generator',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Assets', 'Generators'],
    }),

    updateGenerator: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/stock-assets/update_generator',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Assets', 'Generators'],
    }),

    // Vehicles
    getVehicles: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/stock-assets/view_vehicle',
            method: 'POST',
            body: {},
          },
          {},
          {}
        );
        // Transform response to match expected structure
        if (result.error) {
          return { error: result.error };
        }
        // Backend returns { status: true, vehicles: [...] }
        // Return in format expected by assetsSlice thunk
        const vehicles = result.data?.vehicles || result.data?.data || [];
        return { data: { status: true, vehicles } };
      },
      providesTags: ['Assets', 'Vehicles'],
    }),

    createVehicle: builder.mutation({
      queryFn: async (data) => {
        // Check if data contains files (FormData)
        const isFormData = data instanceof FormData;
        
        // Prepare headers
        const headers = {};
        const token = getToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Don't set Content-Type for FormData - browser will set it with boundary
        if (!isFormData) {
          headers['Content-Type'] = 'application/json';
        }
        
        // Make the request
        const baseUrl = getNodeBackendUrl();
        const response = await fetch(`${baseUrl}/api/stock-assets/create_vehicle`, {
          method: 'POST',
          headers,
          body: isFormData ? data : JSON.stringify(data),
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          return { error: { status: response.status, data: result } };
        }
        
        return { data: result };
      },
      invalidatesTags: ['Assets', 'Vehicles'],
    }),

    updateVehicle: builder.mutation({
      queryFn: async (data) => {
        const isFormData = data instanceof FormData;
        if (isFormData) {
          const headers = {};
          const token = getToken();
          if (token) headers.Authorization = `Bearer ${token}`;
          const baseUrl = getNodeBackendUrl();
          const response = await fetch(`${baseUrl}/api/stock-assets/update_vehicle`, {
            method: 'POST',
            headers,
            body: data,
          });
          const result = await response.json();
          if (!response.ok) return { error: { status: response.status, data: result } };
          return { data: result };
        }
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/stock-assets/update_vehicle',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Assets', 'Vehicles'],
    }),

    getVehicleProfile: builder.query({
      queryFn: async (vehicleId) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/stock-assets/vehicle_profile',
            method: 'POST',
            body: { id: vehicleId },
          },
          {},
          {}
        );
        if (result.error) return { error: result.error };
        return { data: result.data?.data || result.data };
      },
      providesTags: (_r, _e, id) => [{ type: 'Vehicles', id: String(id) }],
    }),

    // Remote Controls
    getRemoteControls: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/stock-assets/view_remote_control',
            method: 'POST',
            body: {},
          },
          {},
          {}
        );
        // Transform response to match expected structure
        if (result.error) {
          return { error: result.error };
        }
        // Backend returns { status: true, remote_controls: [...] }
        // Return in format expected by assetsSlice thunk
        const remoteControls = result.data?.remote_controls || result.data?.data || [];
        return { data: { status: true, remote_controls: remoteControls } };
      },
      providesTags: ['Assets', 'RemoteControls'],
    }),

    createRemoteControl: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/stock-assets/create_remote_control',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Assets', 'RemoteControls'],
    }),

    updateRemoteControl: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/stock-assets/update_remote_control',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Assets', 'RemoteControls'],
    }),

    // Batteries
    getBatteries: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/stock-assets/view_battery',
            method: 'POST',
            body: {},
          },
          {},
          {}
        );
        // Transform response to match expected structure
        if (result.error) {
          return { error: result.error };
        }
        // Backend returns { status: true, battery: [...] }
        // Return in format expected by assetsSlice thunk (it checks for 'battery' or 'batteries')
        const batteries = result.data?.battery || result.data?.data || [];
        return { data: { status: true, battery: batteries, batteries } };
      },
      providesTags: ['Assets', 'Batteries'],
    }),

    createBattery: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/stock-assets/create_battery',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Assets', 'Batteries'],
    }),

    updateBattery: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/stock-assets/update_battery',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Assets', 'Batteries'],
    }),

    // Insurance Types
    getInsuranceTypes: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/view_insurance_type',
            method: 'POST',
            body: {},
          },
          {},
          {}
        );
        if (result.error) {
          return { error: result.error };
        }
        // Legacy API returns { status: 'true', count: number, types: [...] }
        // Return in format expected by Redux thunk: { status: 'true', types: [...] }
        return { data: result.data || { status: 'true', types: [] } };
      },
      providesTags: ['Insurance'],
    }),

    // Battery Types
    getBatteryTypes: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/view_battery_type',
            method: 'POST',
            body: {},
          },
          {},
          {}
        );
        if (result.error) {
          return { error: result.error };
        }
        // Legacy API returns { status: 'true', count: number, types: [...] }
        // Return in format expected by components: { status: 'true', types: [...] }
        return { data: result.data || { status: 'true', types: [] } };
      },
      providesTags: ['Batteries'],
    }),

    // Wings
    getWings: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/view_wing',
            method: 'POST',
            body: {},
          },
          {},
          {}
        );
        if (result.error) {
          return { error: result.error };
        }
        // Legacy API returns { status: 'true', count: number, wings: [...] }
        // Return in format expected by components: { status: 'true', wings: [...] }
        return { data: result.data || { status: 'true', wings: [] } };
      },
      providesTags: ['Wings'],
    }),

    // Vehicle Drivers
    getVehicleDrivers: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/vehicle-drivers/list',
            method: 'POST',
            body: {},
          },
          {},
          {}
        );
        if (result.error) {
          return { error: result.error };
        }
        const drivers = result.data?.drivers || result.data?.data || [];
        return { data: { status: true, drivers: drivers } };
      },
      providesTags: ['VehicleDrivers'],
    }),

    // Vehicle Categories
    getVehicleCategories: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/jd-management/vehicle-categories',
            method: 'POST',
            body: {},
          },
          {},
          {}
        );
        if (result.error) {
          return { error: result.error };
        }
        // Backend returns { status: true, data: [...] }
        const categories = result.data?.data || result.data || [];
        // Return the array directly so RTK Query can use it
        return { data: categories };
      },
      providesTags: ['VehicleCategories'],
    }),

    getVehicleMakes: builder.query({
      queryFn: async ({ vehicle_category_id } = {}) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/jd-management/vehicle-makes',
            method: 'POST',
            body: { vehicle_category_id: vehicle_category_id || null },
          },
          {},
          {}
        );
        if (result.error) {
          return { error: result.error };
        }
        const makes = result.data?.data || result.data || [];
        return { data: makes };
      },
      providesTags: ['VehicleCategories'],
    }),

    getVehicleModels: builder.query({
      queryFn: async ({ vehicle_make_id } = {}) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/jd-management/vehicle-models',
            method: 'POST',
            body: { vehicle_make_id: vehicle_make_id || null },
          },
          {},
          {}
        );
        if (result.error) {
          return { error: result.error };
        }
        const models = result.data?.data || result.data || [];
        return { data: models };
      },
      providesTags: ['VehicleCategories'],
    }),

    // Fuel Categories
    getFuelCategories: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/jd-management/fuel-categories',
            method: 'POST',
            body: {},
          },
          {},
          {}
        );
        if (result.error) {
          return { error: result.error };
        }
        // Backend returns { status: true, data: [...] }
        const categories = result.data?.data || result.data || [];
        // Return the array directly so RTK Query can use it
        return { data: categories };
      },
      providesTags: ['FuelCategories'],
    }),

    saveFuelCategory: builder.mutation({
      queryFn: async (body) => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/jd-management/fuel-categories/save', method: 'POST', body },
          {},
          {}
        );
        if (result.error) return { error: result.error };
        return { data: result.data?.data || null };
      },
      invalidatesTags: ['FuelCategories'],
    }),

    getOfficialFuelPrices: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/jd-management/fuel-categories/official-prices', method: 'POST', body: {} },
          {},
          {}
        );
        if (result.error) return { error: result.error };
        return { data: result.data?.data || null };
      },
    }),

    refreshFuelCategoryOfficialSnapshots: builder.mutation({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/jd-management/fuel-categories/refresh-official-snapshots', method: 'POST', body: {} },
          {},
          {}
        );
        if (result.error) return { error: result.error };
        return { data: result.data?.data || null };
      },
      invalidatesTags: ['FuelCategories'],
    }),

    // Sector Updates
    updateAssetsSectorDrone: builder.mutation({
      query: (data) => ({
        url: 'update_assets_sector_drone',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Assets', 'Drones'],
    }),

    updateAssetsSectorVehicle: builder.mutation({
      query: (data) => ({
        url: 'update_assets_sector_vehicle',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Assets', 'Vehicles'],
    }),

    updateAssetsSectorGenerator: builder.mutation({
      query: (data) => ({
        url: 'update_assets_sector_generator',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Assets', 'Generators'],
    }),

    updateAssetsSectorRemoteControl: builder.mutation({
      query: (data) => ({
        url: 'update_assets_sector_remote_control',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Assets', 'RemoteControls'],
    }),

    updateAssetsSectorBattery: builder.mutation({
      query: (data) => ({
        url: 'update_assets_sector_battery',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Assets', 'Batteries'],
    }),
  }),
});

export const {
  useGetDronesQuery,
  useCreateDroneMutation,
  useUpdateDroneMutation,
  useGetGeneratorsQuery,
  useCreateGeneratorMutation,
  useUpdateGeneratorMutation,
  useGetVehiclesQuery,
  useGetVehicleProfileQuery,
  useCreateVehicleMutation,
  useUpdateVehicleMutation,
  useGetRemoteControlsQuery,
  useCreateRemoteControlMutation,
  useUpdateRemoteControlMutation,
  useGetBatteriesQuery,
  useCreateBatteryMutation,
  useUpdateBatteryMutation,
  useGetInsuranceTypesQuery,
  useGetBatteryTypesQuery,
    useGetWingsQuery,
    useGetVehicleDriversQuery,
    useGetVehicleCategoriesQuery,
    useGetVehicleMakesQuery,
    useGetVehicleModelsQuery,
    useGetFuelCategoriesQuery,
    useSaveFuelCategoryMutation,
    useGetOfficialFuelPricesQuery,
    useLazyGetOfficialFuelPricesQuery,
    useRefreshFuelCategoryOfficialSnapshotsMutation,
    useUpdateAssetsSectorDroneMutation,
    useUpdateAssetsSectorVehicleMutation,
    useUpdateAssetsSectorGeneratorMutation,
    useUpdateAssetsSectorRemoteControlMutation,
    useUpdateAssetsSectorBatteryMutation,
} = assetsApi;

