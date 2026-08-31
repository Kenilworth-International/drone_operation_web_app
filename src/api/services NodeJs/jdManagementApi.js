import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery, getNodeBackendUrl, getToken } from './nodeBackendConfig';

export const jdManagementApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // =====================================================
    // USER LEVELS
    // =====================================================
    getUserLevels: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/user-levels',
            method: 'POST',
            body: {},
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['UserLevels'],
    }),

    saveUserLevel: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/user-levels/save',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['UserLevels', 'UserJobRoles', 'JobRoles'],
    }),

    // =====================================================
    // USER MEMBER TYPES
    // =====================================================
    getUserMemberTypes: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/user-member-types',
            method: 'POST',
            body: {},
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['UserMemberTypes'],
    }),

    saveUserMemberType: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/user-member-types/save',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['UserMemberTypes', 'UserJobRoles', 'JobRoles'],
    }),

    // =====================================================
    // WINGS
    // =====================================================
    getWings: builder.query({
      queryFn: async () => {
        try {
          const result = await nodeBackendBaseQuery(
            {
              url: '/api/jd-management/wings',
              method: 'POST',
              body: {},
            },
            {},
            {}
          );
          
          // Handle response - backend can return:
          // New format: { status: true, data: [...] }
          // Legacy format: { status: 'true', count: 7, wings: [...] }
          if (result.error) {
            return { error: result.error };
          }
          
          // Return the response as-is, let the component handle the structure
          // Component will check for result.data, result.data.data, or result.wings
          return { data: result.data || result };
        } catch (error) {
          return { error: { status: 'FETCH_ERROR', error: error.message } };
        }
      },
      providesTags: ['Wings'],
    }),

    saveWing: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/jd-management/wings/save',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Wings'],
    }),

    // =====================================================
    // DRIVING LICENSE TYPES
    // =====================================================
    getDrivingLicenseTypes: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/driving-license-types',
            method: 'POST',
            body: {},
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['DrivingLicenseTypes'],
    }),

    // =====================================================
    // VEHICLE MASTER DATA
    // =====================================================
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
        if (result.error) return result;
        return { data: result.data?.data || [] };
      },
      providesTags: ['VehicleCategories'],
    }),

    saveVehicleCategory: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/jd-management/vehicle-categories/save',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['VehicleCategories'],
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
        if (result.error) return result;
        return { data: result.data?.data || [] };
      },
      providesTags: ['VehicleMakes'],
    }),

    saveVehicleMake: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/jd-management/vehicle-makes/save',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['VehicleMakes', 'VehicleModels'],
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
        if (result.error) return result;
        return { data: result.data?.data || [] };
      },
      providesTags: ['VehicleModels'],
    }),

    saveVehicleModel: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/jd-management/vehicle-models/save',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['VehicleModels'],
    }),

    // =====================================================
    // WORK LOCATIONS
    // =====================================================
    getWorkLocations: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/work-locations',
            method: 'POST',
            body: {},
          },
          {},
          {}
        );
        
        // Handle response - backend returns { status: true, data: workLocations }
        if (result.error) {
          return result;
        }
        
        // Transform response to match expected structure
        if (result.data && result.data.data) {
          return { data: result.data.data };
        }
        
        return result;
      },
      providesTags: ['WorkLocations'],
    }),

    saveWorkLocation: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/jd-management/work-locations/save',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['WorkLocations'],
    }),

    // =====================================================
    // DSCS (DIVISIONAL SECRETARIATS)
    // =====================================================
    getDSCS: builder.query({
      queryFn: async (arg) => {
        const filters = arg || {};
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/dscs',
            method: 'POST',
            body: filters,
          },
          {},
          {}
        );
        
        // Handle response - backend returns { status: true, data: dscs }
        if (result.error) {
          return result;
        }
        
        // Transform response to match expected structure
        if (result.data && result.data.data) {
          return { data: result.data.data };
        }
        
        return result;
      },
      providesTags: ['DSCS'],
    }),
    saveDSCS: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/jd-management/dscs/save',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['DSCS'],
    }),

    // =====================================================
    // PROVINCES
    // =====================================================
    getProvinces: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/provinces',
            method: 'POST',
            body: {},
          },
          {},
          {}
        );
        
        if (result.error) {
          return result;
        }
        
        if (result.data && result.data.data) {
          return { data: result.data.data };
        }
        
        return result;
      },
      providesTags: ['Provinces'],
    }),
    saveProvince: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/jd-management/provinces/save',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Provinces'],
    }),

    // =====================================================
    // DISTRICTS
    // =====================================================
    getDistricts: builder.query({
      queryFn: async (arg) => {
        const filters = arg || {};
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/districts',
            method: 'POST',
            body: filters,
          },
          {},
          {}
        );
        
        if (result.error) {
          return result;
        }
        
        if (result.data && result.data.data) {
          return { data: result.data.data };
        }
        
        return result;
      },
      providesTags: ['Districts'],
    }),
    saveDistrict: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/jd-management/districts/save',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Districts'],
    }),

    // =====================================================
    // GROUPS
    // =====================================================
    getGroups: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/groups',
            method: 'POST',
            body: {},
          },
          {},
          {}
        );
        
        if (result.error) {
          return result;
        }
        
        // Handle response: { status: true, data: [...] }
        if (result.data && result.data.status && result.data.data) {
          return { data: result.data.data };
        }
        
        // Handle direct array response
        if (Array.isArray(result.data)) {
          return { data: result.data };
        }
        
        return result;
      },
      providesTags: ['Groups'],
    }),

    // =====================================================
    // PLANTATIONS
    // =====================================================
    getPlantations: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/plantations',
            method: 'POST',
            body: {},
          },
          {},
          {}
        );
        
        if (result.error) {
          return result;
        }
        
        // Handle response: { status: true, data: [...] }
        if (result.data && result.data.status && result.data.data) {
          return { data: result.data.data };
        }
        
        // Handle direct array response
        if (Array.isArray(result.data)) {
          return { data: result.data };
        }
        
        return result;
      },
      providesTags: ['Plantations'],
    }),

    // =====================================================
    // REGIONS
    // =====================================================
    getRegions: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/regions',
            method: 'POST',
            body: {},
          },
          {},
          {}
        );
        
        if (result.error) {
          return result;
        }
        
        // Handle response: { status: true, data: [...] }
        if (result.data && result.data.status && result.data.data) {
          return { data: result.data.data };
        }
        
        // Handle direct array response
        if (Array.isArray(result.data)) {
          return { data: result.data };
        }
        
        return result;
      },
      providesTags: ['Regions'],
    }),

    // =====================================================
    // ESTATES
    // =====================================================
    getEstates: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/estates',
            method: 'POST',
            body: {},
          },
          {},
          {}
        );
        
        if (result.error) {
          return result;
        }
        
        // Handle response: { status: true, data: [...] }
        if (result.data && result.data.status && result.data.data) {
          return { data: result.data.data };
        }
        
        // Handle direct array response
        if (Array.isArray(result.data)) {
          return { data: result.data };
        }
        
        return result;
      },
      providesTags: ['Estates'],
    }),

    // =====================================================
    // ASCS (AGRARIAN SERVICE CENTERS)
    // =====================================================
    getASCS: builder.query({
      queryFn: async (arg) => {
        const filters = arg || {};
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/ascs',
            method: 'POST',
            body: filters,
          },
          {},
          {}
        );
        
        if (result.error) {
          return result;
        }
        
        if (result.data && result.data.data) {
          return { data: result.data.data };
        }
        
        return result;
      },
      providesTags: ['ASCS'],
    }),
    saveASCS: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/jd-management/ascs/save',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['ASCS'],
    }),

    // =====================================================
    // USER JOB ROLES
    // =====================================================
    getUserJobRoles: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/user-job-roles',
            method: 'POST',
            body: {},
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['UserJobRoles'],
    }),

    getUserJobRoleById: builder.query({
      queryFn: async (id) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/user-job-roles/view',
            method: 'POST',
            body: { id },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: (result, error, id) => [{ type: 'UserJobRoles', id }],
    }),

    createUserJobRole: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/user-job-roles/create',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['UserJobRoles', 'JobRoles'],
    }),

    updateUserJobRole: builder.mutation({
      queryFn: async ({ id, ...data }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/user-job-roles/update',
            method: 'POST',
            body: { id, ...data },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: (result, error, { id }) => [
        { type: 'UserJobRoles', id },
        'UserJobRoles',
        'JobRoles',
      ],
    }),

    deleteUserJobRole: builder.mutation({
      queryFn: async (id) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/user-job-roles/delete',
            method: 'POST',
            body: { id },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['UserJobRoles'],
    }),

    // =====================================================
    // USER JOB DESCRIPTIONS
    // =====================================================
    getUserJobDescriptions: builder.query({
      queryFn: async (arg) => {
        const body = typeof arg === 'object' && arg !== null
          ? arg
          : (arg ? { jobRoleId: arg } : {});
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/user-job-descriptions',
            method: 'POST',
            body,
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['UserJobDescriptions'],
    }),

    getUserJobDescriptionById: builder.query({
      queryFn: async (id) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/user-job-descriptions/view',
            method: 'POST',
            body: { id },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: (result, error, id) => [{ type: 'UserJobDescriptions', id }],
    }),

    createUserJobDescription: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/user-job-descriptions/create',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['UserJobDescriptions'],
    }),

    createMultipleUserJobDescriptions: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/user-job-descriptions/bulk',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['UserJobDescriptions'],
    }),

    updateUserJobDescription: builder.mutation({
      queryFn: async ({ id, ...data }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/user-job-descriptions/update',
            method: 'POST',
            body: { id, ...data },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: (result, error, { id }) => [{ type: 'UserJobDescriptions', id }, 'UserJobDescriptions'],
    }),

    deleteUserJobDescription: builder.mutation({
      queryFn: async (id) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/user-job-descriptions/delete',
            method: 'POST',
            body: { id },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['UserJobDescriptions'],
    }),

    // =====================================================
    // GET JOB ROLE WITH DESCRIPTIONS
    // =====================================================
    getUserJobRoleWithDescriptions: builder.query({
      queryFn: async (id) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/user-job-roles/descriptions',
            method: 'POST',
            body: { id },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: (result, error, id) => [{ type: 'UserJobRoles', id }, 'UserJobDescriptions'],
    }),

    // =====================================================
    // FIND DESCRIPTIONS BY TASK TEXT (for shared tasks)
    // =====================================================
    findDescriptionsByTaskText: builder.query({
      queryFn: async (taskDescription) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/user-job-descriptions/search/by-text',
            method: 'POST',
            body: { taskDescription },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['UserJobDescriptions'],
    }),

    // =====================================================
    // GET SHARED DESIGNATIONS FOR TASK
    // =====================================================
    getSharedDesignationsForTask: builder.query({
      queryFn: async (taskId) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/user-job-descriptions/shared-designations',
            method: 'POST',
            body: { taskId },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['UserJobDescriptions'],
    }),

    // =====================================================
    // UPDATE TASK ORDERS (for drag and drop)
    // =====================================================
    updateTaskOrders: builder.mutation({
      queryFn: async ({ jobRoleId, emp_designation_id, taskOrders }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/user-job-descriptions/update-orders',
            method: 'POST',
            body: { jobRoleId, emp_designation_id, taskOrders },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['UserJobDescriptions'],
    }),

    // =====================================================
    // EMPLOYEE REGISTRATION
    // =====================================================
    createEmployeeRegistration: builder.mutation({
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
        const response = await fetch(`${baseUrl}/api/employee-registration/create`, {
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
      invalidatesTags: ['EmployeeRegistrations'],
    }),

    updateEmployeeRegistration: builder.mutation({
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
        const response = await fetch(`${baseUrl}/api/employee-registration/update`, {
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
      invalidatesTags: ['EmployeeRegistrations'],
    }),

    forwardToPayroll: builder.mutation({
      queryFn: async ({ id }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/employee-registration/forward-to-payroll',
            method: 'POST',
            body: { id },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['EmployeeRegistrations'],
    }),

    getAllEmployeeRegistrations: builder.query({
      queryFn: async (arg = {}) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/employee-registration/list',
            method: 'POST',
            body: arg?.full ? { full: 1 } : { light: 1 },
          },
          {},
          {}
        );
        if (result.error) return result;
        const payload = result.data;
        const rows = Array.isArray(payload?.data)
          ? payload.data
          : (Array.isArray(payload) ? payload : []);
        return { data: rows };
      },
      providesTags: ['EmployeeRegistrations'],
    }),

    getEmployeeRegistrationById: builder.query({
      queryFn: async ({ id }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/employee-registration/view',
            method: 'POST',
            body: { id },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['EmployeeRegistrations'],
    }),

    getLastEmpNo: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/employee-registration/last-emp-no',
            method: 'POST',
            body: {},
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['EmployeeRegistrations'],
    }),

    checkEmpNo: builder.query({
      queryFn: async ({ empNoSuffix, excludeEmployeeId } = {}) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/employee-registration/check-emp-no',
            method: 'POST',
            body: {
              empNoSuffix,
              excludeEmployeeId: excludeEmployeeId || null,
            },
          },
          {},
          {}
        );
        return result;
      },
    }),

    // =====================================================
    // EMPLOYEE ASSIGNMENT
    // =====================================================
    getEmployeeAssignmentQueues: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/employee-assignment/queues',
            method: 'POST',
            body: {},
          },
          {},
          {}
        );
        if (result.error) return result;
        const payload = result.data;
        const queues = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
        return { data: queues || { assignedEmployees: [], nonAssignedEmployees: [] } };
      },
      providesTags: ['EmployeeAssignment'],
    }),

    getEmployeeAssignmentHistory: builder.query({
      queryFn: async ({ employeeId, limit, offset }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/employee-assignment/history',
            method: 'POST',
            body: { employeeId, limit, offset },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['EmployeeAssignment'],
    }),

    applyEmployeeAssignment: builder.mutation({
      queryFn: async (data) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/employee-assignment/apply',
            method: 'POST',
            body: data,
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['EmployeeAssignment', 'EmployeeRegistrations', 'Users', 'EmpOrgStructure'],
    }),

    // =====================================================
    // USER MANAGEMENT
    // =====================================================
    searchEmployee: builder.query({
      queryFn: async ({ searchTerm }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/users/search-employee',
            method: 'POST',
            body: { searchTerm },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['Employees'],
    }),

    getDriverFuelCards: builder.query({
      queryFn: async (arg) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/users/fuel-cards',
            method: 'POST',
            body: { user_id: arg?.user_id || null },
          },
          {},
          {}
        );
        if (result.error) return result;
        return { data: result.data?.data || [] };
      },
      providesTags: ['FinancialCards'],
    }),

    createUser: builder.mutation({
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
        const response = await fetch(`${baseUrl}/api/users/create`, {
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
      invalidatesTags: ['Users'],
    }),

    getAllUsers: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/users/list',
            method: 'POST',
            body: {},
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['Users'],
    }),

    getUserById: builder.query({
      queryFn: async ({ id }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/users/view',
            method: 'POST',
            body: { id },
          },
          {},
          {}
        );
        return result;
      },
      providesTags: ['Users'],
    }),

    updateUser: builder.mutation({
      queryFn: async (args) => {
        // Handle both FormData and regular object
        const isFormData = args instanceof FormData;
        let id, data;
        
        if (isFormData) {
          // If FormData, id should already be appended
          data = args;
        } else {
          // Regular object destructuring
          ({ id, ...data } = args);
        }
        
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
        let body;
        
        if (isFormData) {
          // If FormData, ensure id is appended
          if (!data.has('id')) {
            data.append('id', id);
          }
          body = data;
        } else {
          body = JSON.stringify({ id, ...data });
        }
        
        const response = await fetch(`${baseUrl}/api/users/update`, {
          method: 'POST',
          headers,
          body,
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          return { error: { status: response.status, data: result } };
        }
        
        return { data: result };
      },
      invalidatesTags: ['Users'],
    }),

    deleteUser: builder.mutation({
      queryFn: async ({ id }) => {
        const result = await nodeBackendBaseQuery(
          {
            url: '/api/users/delete',
            method: 'POST',
            body: { id },
          },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['Users'],
    }),

    getFinanceCategoriesMaster: builder.query({
      queryFn: async () => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/jd-management/finance-categories', method: 'POST', body: {} },
          {},
          {}
        );
        if (result.error) return { error: result.error };
        return { data: result.data?.data || result.data || [] };
      },
      providesTags: ['FinanceMasterData'],
    }),

    saveFinanceCategoryMaster: builder.mutation({
      queryFn: async (body) => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/jd-management/finance-categories/save', method: 'POST', body },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['FinanceMasterData'],
    }),

    getFinanceSubCategoriesMaster: builder.query({
      queryFn: async (body = {}) => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/jd-management/finance-sub-categories', method: 'POST', body },
          {},
          {}
        );
        if (result.error) return { error: result.error };
        return { data: result.data?.data || result.data || [] };
      },
      providesTags: ['FinanceMasterData'],
    }),

    saveFinanceSubCategoryMaster: builder.mutation({
      queryFn: async (body) => {
        const result = await nodeBackendBaseQuery(
          { url: '/api/jd-management/finance-sub-categories/save', method: 'POST', body },
          {},
          {}
        );
        return result;
      },
      invalidatesTags: ['FinanceMasterData'],
    }),
  }),
});

export const {
  useGetUserLevelsQuery,
  useSaveUserLevelMutation,
  useGetUserMemberTypesQuery,
  useSaveUserMemberTypeMutation,
  useGetWingsQuery,
  useSaveWingMutation,
  useGetDrivingLicenseTypesQuery,
  useGetVehicleCategoriesQuery,
  useSaveVehicleCategoryMutation,
  useGetVehicleMakesQuery,
  useSaveVehicleMakeMutation,
  useGetVehicleModelsQuery,
  useSaveVehicleModelMutation,
  useGetWorkLocationsQuery,
  useSaveWorkLocationMutation,
  useGetDSCSQuery,
  useSaveDSCSMutation,
  useGetProvincesQuery,
  useSaveProvinceMutation,
  useGetDistrictsQuery,
  useSaveDistrictMutation,
  useGetASCSQuery,
  useSaveASCSMutation,
  useGetGroupsQuery,
  useGetPlantationsQuery,
  useGetRegionsQuery,
  useGetEstatesQuery,
  useGetUserJobRolesQuery,
  useGetUserJobRoleByIdQuery,
  useCreateUserJobRoleMutation,
  useUpdateUserJobRoleMutation,
  useDeleteUserJobRoleMutation,
  useGetUserJobDescriptionsQuery,
  useGetUserJobDescriptionByIdQuery,
  useCreateUserJobDescriptionMutation,
  useCreateMultipleUserJobDescriptionsMutation,
  useUpdateUserJobDescriptionMutation,
  useDeleteUserJobDescriptionMutation,
  useGetUserJobRoleWithDescriptionsQuery,
  useFindDescriptionsByTaskTextQuery,
  useGetSharedDesignationsForTaskQuery,
  useUpdateTaskOrdersMutation,
  useCreateEmployeeRegistrationMutation,
  useUpdateEmployeeRegistrationMutation,
  useForwardToPayrollMutation,
  useGetAllEmployeeRegistrationsQuery,
  useGetEmployeeRegistrationByIdQuery,
  useGetLastEmpNoQuery,
  useLazyCheckEmpNoQuery,
  useGetEmployeeAssignmentQueuesQuery,
  useGetEmployeeAssignmentHistoryQuery,
  useApplyEmployeeAssignmentMutation,
  useSearchEmployeeQuery,
  useGetDriverFuelCardsQuery,
  useCreateUserMutation,
  useGetAllUsersQuery,
  useGetUserByIdQuery,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useGetFinanceCategoriesMasterQuery,
  useSaveFinanceCategoryMasterMutation,
  useGetFinanceSubCategoriesMasterQuery,
  useSaveFinanceSubCategoryMasterMutation,
} = jdManagementApi;

