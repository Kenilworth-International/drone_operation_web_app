import React, { useState, useEffect } from 'react';
import { FaClipboardList, FaUsers } from 'react-icons/fa';
import '../../styles/supplierRegistration.css';
import { AdminPanel, AdminSubTabs } from './shell/AdminStockShell';
import SuppliersList from './SuppliersList';
import {
  useCreateSupplierMutation,
  useGetLastSupplierCodeQuery,
  useGetMainCategoriesQuery,
  useGetSubCategoriesQuery,
  useGetSubSubCategoriesQuery,
} from '../../api/services NodeJs/stockAssetsApi';

const INNER_TABS = [
  { key: 'registration', label: 'Register Supplier' },
  { key: 'suppliers', label: 'Supplier List' },
];

const SupplierRegistration = ({ embedded = false }) => {
  const [activeTab, setActiveTab] = useState('registration');
  const [createSupplier, { isLoading: isCreating }] = useCreateSupplierMutation();
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const [selectedMainCategory, setSelectedMainCategory] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');

  const userData = JSON.parse(localStorage.getItem('userData')) || {};
  const [formData, setFormData] = useState({
    supplier_code: '',
    supplier_name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    main_category_id: '',
    sub_category_id: '',
    sub_sub_category_id: '',
    status: 'active',
    created_by: userData.id || null,
  });

  const { data: lastSupplierCodeResponse, refetch: refetchLastSupplierCode, isLoading: isLoadingLastCode, isFetching: isFetchingLastCode } = useGetLastSupplierCodeQuery(undefined, { skip: false });

  const { data: mainCategoriesResponse } = useGetMainCategoriesQuery({});
  const { data: subCategoriesResponse } = useGetSubCategoriesQuery(
    selectedMainCategory ? { main_category_id: selectedMainCategory } : {},
    { skip: !selectedMainCategory }
  );
  const { data: subSubCategoriesResponse } = useGetSubSubCategoriesQuery(
    selectedSubCategory ? { sub_category_id: selectedSubCategory } : {},
    { skip: !selectedSubCategory }
  );

  const mainCategories = Array.isArray(mainCategoriesResponse)
    ? mainCategoriesResponse
    : (mainCategoriesResponse?.data ? (Array.isArray(mainCategoriesResponse.data) ? mainCategoriesResponse.data : []) : []);
  const subCategories = Array.isArray(subCategoriesResponse)
    ? subCategoriesResponse
    : (subCategoriesResponse?.data ? (Array.isArray(subCategoriesResponse.data) ? subCategoriesResponse.data : []) : []);
  const subSubCategories = Array.isArray(subSubCategoriesResponse)
    ? subSubCategoriesResponse
    : (subSubCategoriesResponse?.data ? (Array.isArray(subSubCategoriesResponse.data) ? subSubCategoriesResponse.data : []) : []);

  const generateNextSupplierCode = (lastCode) => {
    if (!lastCode) return 'SUP0001';
    const match = lastCode.match(/^SUP(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      return `SUP${String(num + 1).padStart(4, '0')}`;
    }
    return 'SUP0001';
  };

  useEffect(() => {
    const isStillLoading = isLoadingLastCode || isFetchingLastCode;
    if (!isStillLoading && lastSupplierCodeResponse !== undefined) {
      const lastCode = lastSupplierCodeResponse?.last_code ?? null;
      const estimatedCode = generateNextSupplierCode(lastCode);
      setFormData((prev) => ({ ...prev, supplier_code: estimatedCode }));
    } else if (!isStillLoading) {
      setFormData((prev) => ({ ...prev, supplier_code: 'SUP0001' }));
    }
  }, [lastSupplierCodeResponse, isLoadingLastCode, isFetchingLastCode]);

  useEffect(() => {
    setSelectedSubCategory('');
    setFormData((prev) => ({ ...prev, sub_category_id: '', sub_sub_category_id: '' }));
  }, [selectedMainCategory]);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, sub_sub_category_id: '' }));
  }, [selectedSubCategory]);

  useEffect(() => {
    if (message && messageType === 'success') {
      const timer = setTimeout(() => { setMessage(''); setMessageType(''); }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message, messageType]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      supplier_code: '',
      supplier_name: '',
      contact_person: '',
      email: '',
      phone: '',
      address: '',
      main_category_id: '',
      sub_category_id: '',
      sub_sub_category_id: '',
      status: 'active',
      created_by: userData.id || null,
    });
    setSelectedMainCategory('');
    setSelectedSubCategory('');
    refetchLastSupplierCode();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!formData.supplier_code || !formData.supplier_name || !formData.contact_person || !formData.phone) {
      setMessage('Please fill in all required fields');
      setMessageType('error');
      return;
    }

    try {
      const result = await createSupplier({
        ...formData,
        main_category_id: formData.main_category_id || null,
        sub_category_id: formData.sub_category_id || null,
        sub_sub_category_id: formData.sub_sub_category_id || null,
      }).unwrap();
      if (result.status) {
        setMessage('Supplier registered successfully');
        setMessageType('success');
        resetForm();
      }
    } catch (error) {
      setMessage(error?.data?.message || 'Failed to register supplier');
      setMessageType('error');
    }
  };

  return (
    <div className={`supplier-management-container${embedded ? ' supplier-management-container--embedded' : ''}`}>
      {embedded ? (
        <AdminSubTabs tabs={INNER_TABS} active={activeTab} onChange={setActiveTab} />
      ) : (
        <div className="main-tabs-container-supplier-management">
          <button
            type="button"
            className={`main-tab-supplier-management ${activeTab === 'registration' ? 'active' : ''}`}
            onClick={() => setActiveTab('registration')}
          >
            <FaClipboardList className="main-tab-icon-supplier-management" />
            <span>Registration</span>
          </button>
          <button
            type="button"
            className={`main-tab-supplier-management ${activeTab === 'suppliers' ? 'active' : ''}`}
            onClick={() => setActiveTab('suppliers')}
          >
            <FaUsers className="main-tab-icon-supplier-management" />
            <span>Suppliers</span>
          </button>
        </div>
      )}

      <div className="main-tab-content-supplier-management admin-stock-body">
        {activeTab === 'registration' && (
          <AdminPanel className="registration-section-supplier-management">
            {!embedded && (
              <div className="supplier-registration-header">
                <h1 className="heading-supplier-registration">Supplier Registration</h1>
              </div>
            )}

            <div className="supplier-registration-content">
              {message && (
                <div className={`admin-stock-msg ${messageType === 'success' ? 'admin-stock-msg--ok' : 'admin-stock-msg--error'} message-supplier-management ${messageType}`}>
                  {message}
                </div>
              )}
              <form className="form-supplier-registration" onSubmit={handleSubmit}>
                <div className="form-row-supplier-registration admin-stock-grid-2">
                  <div className="form-group-supplier-registration admin-stock-field">
                    <label className="label-supplier-registration" htmlFor="supplier_code">
                      Supplier Code <span className="required-supplier-registration">*</span>
                      <span style={{ fontSize: '12px', color: '#666', marginLeft: '8px', fontWeight: 'normal' }}>(Auto-generated)</span>
                    </label>
                    <input
                      type="text"
                      id="supplier_code"
                      name="supplier_code"
                      className="input-supplier-registration"
                      value={formData.supplier_code}
                      readOnly
                      disabled
                      style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                      required
                    />
                  </div>

                  <div className="form-group-supplier-registration admin-stock-field">
                    <label className="label-supplier-registration" htmlFor="supplier_name">
                      Supplier Name <span className="required-supplier-registration">*</span>
                    </label>
                    <input
                      type="text"
                      id="supplier_name"
                      name="supplier_name"
                      className="input-supplier-registration"
                      value={formData.supplier_name}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-row-supplier-registration">
                  <div className="form-group-supplier-registration">
                    <label className="label-supplier-registration" htmlFor="contact_person">
                      Contact Person <span className="required-supplier-registration">*</span>
                    </label>
                    <input
                      type="text"
                      id="contact_person"
                      name="contact_person"
                      className="input-supplier-registration"
                      value={formData.contact_person}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="form-group-supplier-registration">
                    <label className="label-supplier-registration" htmlFor="phone">
                      Phone <span className="required-supplier-registration">*</span>
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      className="input-supplier-registration"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-row-supplier-registration">
                  <div className="form-group-supplier-registration">
                    <label className="label-supplier-registration" htmlFor="email">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      className="input-supplier-registration"
                      value={formData.email}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group-supplier-registration">
                    <label className="label-supplier-registration" htmlFor="status">
                      Status
                    </label>
                    <select
                      id="status"
                      name="status"
                      className="select-supplier-registration"
                      value={formData.status}
                      onChange={handleChange}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="form-group-supplier-registration">
                  <label className="label-supplier-registration" htmlFor="address">
                    Address
                  </label>
                  <textarea
                    id="address"
                    name="address"
                    className="textarea-supplier-registration"
                    value={formData.address}
                    onChange={handleChange}
                    rows="3"
                  />
                </div>

                <div className="form-row-supplier-registration">
                  <div className="form-group-supplier-registration">
                    <label className="label-supplier-registration" htmlFor="main_category_id">
                      Main Category <span style={{ fontSize: '11px', color: '#999', fontWeight: 'normal' }}>(Optional)</span>
                    </label>
                    <select
                      id="main_category_id"
                      className="select-supplier-registration"
                      value={formData.main_category_id}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((prev) => ({ ...prev, main_category_id: val, sub_category_id: '', sub_sub_category_id: '' }));
                        setSelectedMainCategory(val);
                      }}
                    >
                      <option value="">Select Main Category</option>
                      {mainCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.category_name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group-supplier-registration">
                    <label className="label-supplier-registration" htmlFor="sub_category_id">
                      Sub Category <span style={{ fontSize: '11px', color: '#999', fontWeight: 'normal' }}>(Optional)</span>
                    </label>
                    <select
                      id="sub_category_id"
                      className="select-supplier-registration"
                      value={formData.sub_category_id}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((prev) => ({ ...prev, sub_category_id: val, sub_sub_category_id: '' }));
                        setSelectedSubCategory(val);
                      }}
                      disabled={!formData.main_category_id}
                    >
                      <option value="">Select Sub Category</option>
                      {subCategories
                        .filter((sub) => sub.main_category_id === parseInt(formData.main_category_id))
                        .map((sub) => (
                          <option key={sub.id} value={sub.id}>{sub.sub_category_name}</option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="form-row-supplier-registration">
                  <div className="form-group-supplier-registration">
                    <label className="label-supplier-registration" htmlFor="sub_sub_category_id">
                      Sub-Sub Category <span style={{ fontSize: '11px', color: '#999', fontWeight: 'normal' }}>(Optional)</span>
                    </label>
                    <select
                      id="sub_sub_category_id"
                      className="select-supplier-registration"
                      value={formData.sub_sub_category_id}
                      onChange={(e) => setFormData((prev) => ({ ...prev, sub_sub_category_id: e.target.value }))}
                      disabled={!formData.sub_category_id}
                    >
                      <option value="">Select Sub-Sub Category</option>
                      {subSubCategories
                        .filter((ssc) => ssc.sub_category_id === parseInt(formData.sub_category_id))
                        .map((ssc) => (
                          <option key={ssc.id} value={ssc.id}>{ssc.sub_sub_category_name}</option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="form-actions-supplier-registration">
                  <button type="submit" className="admin-stock-btn admin-stock-btn--primary btn-submit-supplier-registration" disabled={isCreating}>
                    {isCreating ? 'Registering...' : 'Register Supplier'}
                  </button>
                  <button type="button" className="admin-stock-btn btn-cancel-supplier-registration" onClick={resetForm}>
                    Clear
                  </button>
                </div>
              </form>
            </div>
          </AdminPanel>
        )}

        {activeTab === 'suppliers' && (
          <div className="suppliers-section-supplier-management admin-stock-body">
            <SuppliersList />
          </div>
        )}
      </div>
    </div>
  );
};

export default SupplierRegistration;
