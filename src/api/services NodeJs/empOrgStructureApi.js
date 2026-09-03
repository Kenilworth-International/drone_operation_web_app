import { baseApi } from '../baseApi';
import { nodeBackendBaseQuery } from './nodeBackendConfig';

const BASE = '/api/emp-org-structure';

async function post(url, body = {}) {
  const result = await nodeBackendBaseQuery({ url, method: 'POST', body }, {}, {});
  if (result.error) return result;
  return { data: result.data?.data ?? result.data };
}

export const empOrgStructureApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getEmpDepartments: builder.query({
      queryFn: async () => post(`${BASE}/departments`),
      providesTags: ['EmpOrgStructure'],
    }),
    saveEmpDepartment: builder.mutation({
      queryFn: async (body) => post(`${BASE}/departments/save`, body),
      invalidatesTags: ['EmpOrgStructure'],
    }),
    getEmpDivisions: builder.query({
      queryFn: async (dept_id) => post(`${BASE}/divisions`, { dept_id }),
      providesTags: ['EmpOrgStructure'],
    }),
    saveEmpDivision: builder.mutation({
      queryFn: async (body) => post(`${BASE}/divisions/save`, body),
      invalidatesTags: ['EmpOrgStructure'],
    }),
    getEmpSubDivisions: builder.query({
      queryFn: async (arg) => {
        const body = arg != null && typeof arg === 'object'
          ? arg
          : { dept_id: arg };
        return post(`${BASE}/sub-divisions`, body);
      },
      providesTags: ['EmpOrgStructure'],
    }),
    saveEmpSubDivision: builder.mutation({
      queryFn: async (body) => post(`${BASE}/sub-divisions/save`, body),
      invalidatesTags: ['EmpOrgStructure'],
    }),
    getEmpManagementLayers: builder.query({
      queryFn: async () => post(`${BASE}/management-layers`),
      providesTags: ['EmpOrgStructure'],
    }),
    getEmpJobRoles: builder.query({
      queryFn: async () => post(`${BASE}/job-roles`),
      providesTags: ['EmpOrgStructure'],
    }),
    saveEmpJobRole: builder.mutation({
      queryFn: async (body) => post(`${BASE}/job-roles/save`, body),
      invalidatesTags: ['EmpOrgStructure'],
    }),
    deleteEmpJobRole: builder.mutation({
      queryFn: async (id) => post(`${BASE}/job-roles/delete`, { id }),
      invalidatesTags: ['EmpOrgStructure'],
    }),
    getEmpSpecializations: builder.query({
      queryFn: async (filters = {}) => post(`${BASE}/specializations`, filters),
      providesTags: ['EmpOrgStructure'],
    }),
    saveEmpSpecialization: builder.mutation({
      queryFn: async (body) => post(`${BASE}/specializations/save`, body),
      invalidatesTags: ['EmpOrgStructure'],
    }),
    deleteEmpSpecialization: builder.mutation({
      queryFn: async (id) => post(`${BASE}/specializations/delete`, { id }),
      invalidatesTags: ['EmpOrgStructure'],
    }),
    previewEmpSpecialization: builder.mutation({
      queryFn: async (body) => post(`${BASE}/specializations/preview`, body),
    }),
    getEmpDesignations: builder.query({
      queryFn: async (filters = {}) => post(`${BASE}/designations`, filters),
      providesTags: ['EmpOrgStructure'],
    }),
    resolveEmpDesignation: builder.mutation({
      queryFn: async (body) => post(`${BASE}/resolve-designation`, body),
    }),
    regenerateEmpDesignations: builder.mutation({
      queryFn: async () => post(`${BASE}/designations/regenerate`),
      invalidatesTags: ['EmpOrgStructure'],
    }),
    getEmpPowerLimitations: builder.query({
      queryFn: async () => post(`${BASE}/power-limitations`),
      providesTags: ['EmpOrgStructure'],
    }),
    saveEmpPowerLimitation: builder.mutation({
      queryFn: async (body) => post(`${BASE}/power-limitations/save`, body),
      invalidatesTags: ['EmpOrgStructure'],
    }),
    getEmpOrgTree: builder.query({
      queryFn: async () => post(`${BASE}/tree`),
      providesTags: ['EmpOrgStructure'],
    }),
    getEmpRoleMaxLimits: builder.query({
      queryFn: async (arg) => {
        const body = typeof arg === 'object' && arg != null
          ? { dept_id: arg.dept_id, exclude_employee_id: arg.exclude_employee_id }
          : { dept_id: arg };
        return post(`${BASE}/role-max-limits`, body);
      },
      providesTags: ['EmpOrgStructure'],
    }),
    saveEmpRoleMaxLimit: builder.mutation({
      queryFn: async (body) => post(`${BASE}/role-max-limits/save`, body),
      invalidatesTags: ['EmpOrgStructure'],
    }),
    getEmpChiefJobRoles: builder.query({
      queryFn: async () => post(`${BASE}/chief-job-roles`),
      providesTags: ['EmpOrgStructure'],
    }),
    saveEmpChiefJobRole: builder.mutation({
      queryFn: async (body) => post(`${BASE}/chief-job-roles/save`, body),
      invalidatesTags: ['EmpOrgStructure', 'UserJobDescriptions'],
    }),
    getEmpHodAssignments: builder.query({
      queryFn: async () => post(`${BASE}/hod-assignments`),
      providesTags: ['EmpOrgStructure'],
    }),
    saveEmpHodAssignment: builder.mutation({
      queryFn: async (body) => post(`${BASE}/hod-assignments/save`, body),
      invalidatesTags: ['EmpOrgStructure'],
    }),
  }),
});

export const {
  useGetEmpDepartmentsQuery,
  useSaveEmpDepartmentMutation,
  useGetEmpDivisionsQuery,
  useSaveEmpDivisionMutation,
  useGetEmpSubDivisionsQuery,
  useSaveEmpSubDivisionMutation,
  useGetEmpManagementLayersQuery,
  useGetEmpJobRolesQuery,
  useSaveEmpJobRoleMutation,
  useDeleteEmpJobRoleMutation,
  useGetEmpSpecializationsQuery,
  useSaveEmpSpecializationMutation,
  useDeleteEmpSpecializationMutation,
  usePreviewEmpSpecializationMutation,
  useGetEmpDesignationsQuery,
  useResolveEmpDesignationMutation,
  useRegenerateEmpDesignationsMutation,
  useGetEmpPowerLimitationsQuery,
  useSaveEmpPowerLimitationMutation,
  useGetEmpOrgTreeQuery,
  useGetEmpRoleMaxLimitsQuery,
  useSaveEmpRoleMaxLimitMutation,
  useGetEmpChiefJobRolesQuery,
  useSaveEmpChiefJobRoleMutation,
  useGetEmpHodAssignmentsQuery,
  useSaveEmpHodAssignmentMutation,
} = empOrgStructureApi;
