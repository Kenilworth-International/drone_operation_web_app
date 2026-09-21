import React, { useState, useEffect, useMemo } from 'react';
import { FaSearch, FaEdit, FaEye, FaTimes, FaPlus, FaClipboardList, FaList } from 'react-icons/fa';
import '../../styles/inventoryItemsRegistration.css';
import { AdminSubTabs } from './shell/AdminStockShell';
import {
  useGetMainCategoriesQuery,
  useCreateMainCategoryMutation,
  useGetLastMainCategoryCodeQuery,
  useGetSubCategoriesQuery,
  useCreateSubCategoryMutation,
  useGetLastSubCategoryCodeQuery,
  useGetSubSubCategoriesQuery,
  useCreateSubSubCategoryMutation,
  useGetLastSubSubCategoryCodeQuery,
  useGetInventoryItemsQuery,
  useCreateInventoryItemMutation,
  useUpdateInventoryItemMutation,
  useGetLastItemCodeQuery,
} from '../../api/services NodeJs/stockAssetsApi';

const INNER_TABS = [
  { key: 'registration', label: 'Register Item' },
  { key: 'items', label: 'Registered Item List' },
];

const InventoryItemsRegistration = ({ embedded = false }) => {
  const userData = JSON.parse(localStorage.getItem('userData')) || {};
  const [activeTab, setActiveTab] = useState('registration');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMainCategory, setSelectedMainCategory] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');
  const [selectedSubSubCategory, setSelectedSubSubCategory] = useState('');
  // Filter states for Registered Item List
  const [filterMainCategory, setFilterMainCategory] = useState('');
  const [filterSubCategory, setFilterSubCategory] = useState('');
  const [filterSubSubCategory, setFilterSubSubCategory] = useState('');
  const [filterItemCategory, setFilterItemCategory] = useState('');
  const [showMainCategoryModal, setShowMainCategoryModal] = useState(false);
  const [showSubCategoryModal, setShowSubCategoryModal] = useState(false);
  const [showSubSubCategoryModal, setShowSubSubCategoryModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSubCategoryImageModal, setShowSubCategoryImageModal] = useState(false);
  const [selectedSubCategoryImage, setSelectedSubCategoryImage] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  // Main Category Form
  const [mainCategoryForm, setMainCategoryForm] = useState({
    category_code: '',
    category_name: '',
    description: '',
    status: 'active',
  });

  // Sub Category Form
  const [subCategoryForm, setSubCategoryForm] = useState({
    sub_category_code: '',
    sub_category_name: '',
    main_category_id: '',
    description: '',
    image: null,
    imagePreview: null,
    status: 'active',
  });

  // Sub-Sub Category Form
  const [subSubCategoryForm, setSubSubCategoryForm] = useState({
    sub_sub_category_code: '',
    sub_sub_category_name: '',
    sub_category_id: '',
    description: '',
    image: null,
    imagePreview: null,
    status: 'active',
  });

  // Inventory Item Form
  const [itemForm, setItemForm] = useState({
    item_code: '',
    item_name: '',
    main_category_id: '',
    sub_category_id: '',
    sub_sub_category_id: '',
    unit: '',
    description: '',
    minimum_floor_stock: '',
    maximum_floor_stock: '',
    minimum_order_qty: '',
    maximum_order_qty: '',
    item_category: 's',
    current_stock: '',
    status: 'active',
  });

  // API Hooks
  const { data: mainCategoriesResponse, refetch: refetchMainCategories } = useGetMainCategoriesQuery({});
  const { data: subCategoriesResponse, refetch: refetchSubCategories } = useGetSubCategoriesQuery(
    selectedMainCategory ? { main_category_id: selectedMainCategory } : {}
  );
  // Fetch all sub categories for filtering (when filterMainCategory is selected)
  const { data: allSubCategoriesResponse } = useGetSubCategoriesQuery(
    filterMainCategory ? { main_category_id: filterMainCategory } : {}
  );
  // Sub-sub categories - driven by selected sub category
  const { data: subSubCategoriesResponse, refetch: refetchSubSubCategories } = useGetSubSubCategoriesQuery(
    selectedSubCategory ? { sub_category_id: selectedSubCategory } : {},
    { skip: !selectedSubCategory }
  );
  // Sub-sub categories for filter
  const { data: allSubSubCategoriesResponse } = useGetSubSubCategoriesQuery(
    filterSubCategory ? { sub_category_id: filterSubCategory } : {},
    { skip: !filterSubCategory }
  );
  const { data: itemsResponse, isLoading, error, refetch: refetchItems } = useGetInventoryItemsQuery({});
  
  // Get last category codes
  const { data: lastMainCategoryCodeResponse, refetch: refetchLastMainCode, isLoading: isLoadingLastMainCode, isFetching: isFetchingLastMainCode } = useGetLastMainCategoryCodeQuery(undefined, { skip: false });
  const { data: lastSubCategoryCodeResponse, refetch: refetchLastSubCode, isLoading: isLoadingLastSubCode, isFetching: isFetchingLastSubCode } = useGetLastSubCategoryCodeQuery(undefined, { skip: false });
  const { data: lastItemCodeResponse, refetch: refetchLastItemCode, isLoading: isLoadingLastItemCode, isFetching: isFetchingLastItemCode } = useGetLastItemCodeQuery(itemForm.item_category, { skip: !itemForm.item_category });
  const { data: lastSubSubCategoryCodeResponse, refetch: refetchLastSubSubCode, isLoading: isLoadingLastSubSubCode, isFetching: isFetchingLastSubSubCode } = useGetLastSubSubCategoryCodeQuery(undefined, { skip: false });
  const [createMainCategory] = useCreateMainCategoryMutation();
  const [createSubCategory] = useCreateSubCategoryMutation();
  const [createSubSubCategory] = useCreateSubSubCategoryMutation();
  const [createInventoryItem] = useCreateInventoryItemMutation();
  const [updateInventoryItem] = useUpdateInventoryItemMutation();

  // When using queryFn, if we return { data: [...] }, RTK Query makes the hook's data be [...]
  // So mainCategoriesResponse should be the array directly
  const mainCategories = Array.isArray(mainCategoriesResponse) 
    ? mainCategoriesResponse 
    : (mainCategoriesResponse?.data ? (Array.isArray(mainCategoriesResponse.data) ? mainCategoriesResponse.data : []) : []);
  const subCategories = Array.isArray(subCategoriesResponse) 
    ? subCategoriesResponse 
    : (subCategoriesResponse?.data ? (Array.isArray(subCategoriesResponse.data) ? subCategoriesResponse.data : []) : []);
  const allSubCategories = Array.isArray(allSubCategoriesResponse) 
    ? allSubCategoriesResponse 
    : (allSubCategoriesResponse?.data ? (Array.isArray(allSubCategoriesResponse.data) ? allSubCategoriesResponse.data : []) : []);
  const subSubCategories = Array.isArray(subSubCategoriesResponse) 
    ? subSubCategoriesResponse 
    : (subSubCategoriesResponse?.data ? (Array.isArray(subSubCategoriesResponse.data) ? subSubCategoriesResponse.data : []) : []);
  const allSubSubCategories = Array.isArray(allSubSubCategoriesResponse) 
    ? allSubSubCategoriesResponse 
    : (allSubSubCategoriesResponse?.data ? (Array.isArray(allSubSubCategoriesResponse.data) ? allSubSubCategoriesResponse.data : []) : []);
  const items = Array.isArray(itemsResponse) 
    ? itemsResponse 
    : (itemsResponse?.data ? (Array.isArray(itemsResponse.data) ? itemsResponse.data : []) : []);

  // Filter items based on search term and filters
  const filteredItems = useMemo(() => {
    let filtered = items;

    // Apply Main Category filter
    if (filterMainCategory) {
      filtered = filtered.filter((item) => item.main_category_id === parseInt(filterMainCategory));
    }

    // Apply Sub Category filter
    if (filterSubCategory) {
      filtered = filtered.filter((item) => item.sub_category_id === parseInt(filterSubCategory));
    }

    // Apply Sub-Sub Category filter
    if (filterSubSubCategory) {
      filtered = filtered.filter((item) => item.sub_sub_category_id === parseInt(filterSubSubCategory));
    }

    // Apply Item Category filter
    if (filterItemCategory) {
      filtered = filtered.filter((item) => item.item_category === filterItemCategory);
    }

    // Apply search term filter
    if (searchTerm.trim()) {
      filtered = filtered.filter((item) =>
        item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.item_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.main_category_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sub_category_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sub_sub_category_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [items, searchTerm, filterMainCategory, filterSubCategory, filterSubSubCategory, filterItemCategory]);

  // Auto-clear messages
  useEffect(() => {
    if (message && messageType === 'success') {
      const timer = setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message, messageType]);

  // Update sub categories when main category changes
  useEffect(() => {
    setSelectedSubCategory('');
    setSelectedSubSubCategory('');
    setSelectedSubCategoryImage(null);
    setItemForm((prev) => ({ ...prev, sub_category_id: '', sub_sub_category_id: '' }));
  }, [selectedMainCategory]);

  // Clear sub-sub category when sub category changes
  useEffect(() => {
    setSelectedSubSubCategory('');
    setItemForm((prev) => ({ ...prev, sub_sub_category_id: '' }));
  }, [selectedSubCategory]);

  // Auto-generate item code when item category changes
  useEffect(() => {
    if (itemForm.item_category) {
      refetchLastItemCode();
    }
  }, [itemForm.item_category, refetchLastItemCode]);

  useEffect(() => {
    if (itemForm.item_category) {
      const isStillLoading = isLoadingLastItemCode || isFetchingLastItemCode;
      
      if (!isStillLoading && lastItemCodeResponse !== undefined) {
        const lastCode = lastItemCodeResponse?.last_code ?? null;
        const estimatedCode = generateNextItemCode(lastCode, itemForm.item_category);
        setItemForm((prev) => ({
          ...prev,
          item_code: estimatedCode,
        }));
      } else if (!isStillLoading && lastItemCodeResponse === undefined) {
        // Default code when no previous code exists
        const defaultCode = itemForm.item_category === 'a' ? 'ASSETS0001' : 'STOCKS0001';
        setItemForm((prev) => ({
          ...prev,
          item_code: defaultCode,
        }));
      }
    } else {
      // Clear item code when no category is selected
      setItemForm((prev) => ({
        ...prev,
        item_code: '',
      }));
    }
  }, [itemForm.item_category, lastItemCodeResponse, isLoadingLastItemCode, isFetchingLastItemCode]);

  // Update sub category filter when main category filter changes
  useEffect(() => {
    setFilterSubCategory('');
    setFilterSubSubCategory('');
  }, [filterMainCategory]);

  // Update sub-sub category filter when sub category filter changes
  useEffect(() => {
    setFilterSubSubCategory('');
  }, [filterSubCategory]);

  // Generate next category code
  const generateNextMainCategoryCode = (lastCode) => {
    if (!lastCode) return 'MAIN001';
    const match = lastCode.match(/^MAIN(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      const nextNum = num + 1;
      return `MAIN${String(nextNum).padStart(3, '0')}`;
    }
    return 'MAIN001';
  };

  const generateNextSubCategoryCode = (lastCode) => {
    if (!lastCode) return 'SUB0001';
    const match = lastCode.match(/^SUB(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      const nextNum = num + 1;
      return `SUB${String(nextNum).padStart(4, '0')}`;
    }
    return 'SUB0001';
  };

  const generateNextSubSubCategoryCode = (lastCode) => {
    if (!lastCode) return 'SUBSUB0001';
    const match = lastCode.match(/^SUBSUB(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      const nextNum = num + 1;
      return `SUBSUB${String(nextNum).padStart(4, '0')}`;
    }
    return 'SUBSUB0001';
  };

  const generateNextItemCode = (lastCode, itemCategory) => {
    const prefix = itemCategory === 'a' ? 'ASSETS' : 'STOCKS';
    if (!lastCode) return `${prefix}0001`;
    const match = lastCode.match(new RegExp(`^${prefix}(\\d+)$`));
    if (match) {
      const num = parseInt(match[1], 10);
      const nextNum = num + 1;
      return `${prefix}${String(nextNum).padStart(4, '0')}`;
    }
    return `${prefix}0001`;
  };

  // Handle Main Category Modal Open
  useEffect(() => {
    if (showMainCategoryModal) {
      refetchLastMainCode();
    }
  }, [showMainCategoryModal, refetchLastMainCode]);

  // Handle Sub Category Modal Open
  useEffect(() => {
    if (showSubCategoryModal) {
      refetchLastSubCode();
    } else {
      // Reset form when modal closes
      setSubCategoryForm({
        sub_category_code: '',
        sub_category_name: '',
        main_category_id: selectedMainCategory || '',
        description: '',
        image: null,
        imagePreview: null,
        status: 'active',
      });
    }
  }, [showSubCategoryModal, refetchLastSubCode, selectedMainCategory]);

  // Auto-fill estimated main category code (read-only)
  useEffect(() => {
    if (showMainCategoryModal) {
      // Wait for the API response to finish loading/fetching
      const isStillLoading = isLoadingLastMainCode || isFetchingLastMainCode;
      
      if (!isStillLoading && lastMainCategoryCodeResponse !== undefined) {
        // Response has loaded, extract the last_code
        // The response structure from RTK Query: { last_code: "MAIN001" } (after API service transformation)
        const lastCode = lastMainCategoryCodeResponse?.last_code ?? null;
        
        const estimatedCode = generateNextMainCategoryCode(lastCode);
        setMainCategoryForm((prev) => ({
          ...prev,
          category_code: estimatedCode,
        }));
      } else if (isStillLoading) {
        // Still loading/fetching, don't set anything yet
        // This prevents defaulting to MAIN001 before we know the actual last code
      } else {
        // Response loaded but last_code is null/undefined, default to MAIN001
        setMainCategoryForm((prev) => ({
          ...prev,
          category_code: 'MAIN001',
        }));
      }
    } else {
      // Reset when modal closes
      setMainCategoryForm((prev) => ({
        ...prev,
        category_code: '',
      }));
    }
  }, [showMainCategoryModal, lastMainCategoryCodeResponse, isLoadingLastMainCode, isFetchingLastMainCode]);

  // Handle Sub-Sub Category Modal Open
  useEffect(() => {
    if (showSubSubCategoryModal) {
      refetchLastSubSubCode();
    } else {
      setSubSubCategoryForm({
        sub_sub_category_code: '',
        sub_sub_category_name: '',
        sub_category_id: selectedSubCategory || '',
        description: '',
        image: null,
        imagePreview: null,
        status: 'active',
      });
    }
  }, [showSubSubCategoryModal, refetchLastSubSubCode, selectedSubCategory]);

  // Auto-fill estimated sub-sub category code (read-only)
  useEffect(() => {
    if (showSubSubCategoryModal) {
      const isStillLoading = isLoadingLastSubSubCode || isFetchingLastSubSubCode;
      if (!isStillLoading && lastSubSubCategoryCodeResponse !== undefined) {
        const lastCode = lastSubSubCategoryCodeResponse?.last_code ?? null;
        const estimatedCode = generateNextSubSubCategoryCode(lastCode);
        setSubSubCategoryForm((prev) => ({
          ...prev,
          sub_sub_category_code: estimatedCode,
        }));
      } else if (!isStillLoading) {
        setSubSubCategoryForm((prev) => ({
          ...prev,
          sub_sub_category_code: 'SUBSUB0001',
        }));
      }
    } else {
      setSubSubCategoryForm((prev) => ({
        ...prev,
        sub_sub_category_code: '',
      }));
    }
  }, [showSubSubCategoryModal, lastSubSubCategoryCodeResponse, isLoadingLastSubSubCode, isFetchingLastSubSubCode]);

  // Auto-fill estimated sub category code (read-only)
  useEffect(() => {
    if (showSubCategoryModal) {
      // Wait for the API response to finish loading/fetching
      const isStillLoading = isLoadingLastSubCode || isFetchingLastSubCode;
      
      if (!isStillLoading && lastSubCategoryCodeResponse !== undefined) {
        // Response has loaded, extract the last_code
        // The response structure from RTK Query: { last_code: "SUB0001" } (after API service transformation)
        const lastCode = lastSubCategoryCodeResponse?.last_code ?? null;
        const estimatedCode = generateNextSubCategoryCode(lastCode);
        setSubCategoryForm((prev) => ({
          ...prev,
          sub_category_code: estimatedCode,
        }));
      } else if (isStillLoading) {
        // Still loading/fetching, don't set anything yet
        // This prevents defaulting to SUB0001 before we know the actual last code
      } else {
        // Response loaded but last_code is null/undefined, default to SUB0001
        setSubCategoryForm((prev) => ({
          ...prev,
          sub_category_code: 'SUB0001',
        }));
      }
    } else {
      // Reset when modal closes
      setSubCategoryForm((prev) => ({
        ...prev,
        sub_category_code: '',
      }));
    }
  }, [showSubCategoryModal, lastSubCategoryCodeResponse, isLoadingLastSubCode, isFetchingLastSubCode]);

  // Handle Main Category Creation
  const handleCreateMainCategory = async (e) => {
    e.preventDefault();
    try {
      // Ensure we have the latest code before submitting
      if (isLoadingLastMainCode || isFetchingLastMainCode) {
        setMessage('Please wait while we fetch the latest category code...');
        setMessageType('info');
        return;
      }
      
      // Code is auto-generated and read-only, so use it directly
      const result = await createMainCategory({
        ...mainCategoryForm,
        created_by: userData.id || null,
      }).unwrap();
      if (result.status) {
        setMessage('Main Category created successfully');
        setMessageType('success');
        setShowMainCategoryModal(false);
        setMainCategoryForm({
          category_code: '',
          category_name: '',
          description: '',
          status: 'active',
        });
        refetchMainCategories();
        refetchLastMainCode();
      }
    } catch (error) {
      const errorMessage = error?.data?.message || error?.message || 'Failed to create main category';
      setMessage(errorMessage);
      setMessageType('error');
      // If it's a duplicate error, refetch the last code to get the updated value
      if (error?.data?.code === 'DUPLICATE_ENTRY' || error?.status === 409) {
        refetchLastMainCode();
      }
    }
  };

  // Handle Sub Category Creation
  const handleCreateSubCategory = async (e) => {
    e.preventDefault();
    if (!subCategoryForm.main_category_id) {
      setMessage('Please select a main category first');
      setMessageType('error');
      return;
    }
    try {
      // Create FormData if image is present, otherwise use regular object
      let formData;
      if (subCategoryForm.image) {
        formData = new FormData();
        formData.append('sub_category_code', subCategoryForm.sub_category_code);
        formData.append('sub_category_name', subCategoryForm.sub_category_name);
        formData.append('main_category_id', subCategoryForm.main_category_id);
        formData.append('description', subCategoryForm.description || '');
        formData.append('status', subCategoryForm.status);
        formData.append('created_by', userData.id || '');
        formData.append('image', subCategoryForm.image);
      } else {
        formData = {
          ...subCategoryForm,
          created_by: userData.id || null,
        };
        // Remove image and imagePreview from regular object
        delete formData.image;
        delete formData.imagePreview;
      }
      
      const result = await createSubCategory(formData).unwrap();
      if (result.status) {
        setMessage('Sub Category created successfully');
        setMessageType('success');
        setShowSubCategoryModal(false);
        setSubCategoryForm({
          sub_category_code: '',
          sub_category_name: '',
          main_category_id: selectedMainCategory || '',
          description: '',
          image: null,
          imagePreview: null,
          status: 'active',
        });
        refetchSubCategories();
        refetchLastSubCode();
      }
    } catch (error) {
      setMessage(error?.data?.message || 'Failed to create sub category');
      setMessageType('error');
    }
  };

  // Handle Sub-Sub Category Creation
  const handleCreateSubSubCategory = async (e) => {
    e.preventDefault();
    if (!subSubCategoryForm.sub_category_id) {
      setMessage('Please select a sub category first');
      setMessageType('error');
      return;
    }
    try {
      let formData;
      if (subSubCategoryForm.image) {
        formData = new FormData();
        formData.append('sub_sub_category_code', subSubCategoryForm.sub_sub_category_code);
        formData.append('sub_sub_category_name', subSubCategoryForm.sub_sub_category_name);
        formData.append('sub_category_id', subSubCategoryForm.sub_category_id);
        formData.append('description', subSubCategoryForm.description || '');
        formData.append('status', subSubCategoryForm.status);
        formData.append('created_by', userData.id || '');
        formData.append('image', subSubCategoryForm.image);
      } else {
        formData = {
          ...subSubCategoryForm,
          created_by: userData.id || null,
        };
        delete formData.image;
        delete formData.imagePreview;
      }

      const result = await createSubSubCategory(formData).unwrap();
      if (result.status) {
        setMessage('Sub-Sub Category created successfully');
        setMessageType('success');
        setShowSubSubCategoryModal(false);
        setSubSubCategoryForm({
          sub_sub_category_code: '',
          sub_sub_category_name: '',
          sub_category_id: selectedSubCategory || '',
          description: '',
          image: null,
          imagePreview: null,
          status: 'active',
        });
        refetchSubSubCategories();
        refetchLastSubSubCode();
      }
    } catch (error) {
      setMessage(error?.data?.message || 'Failed to create sub-sub category');
      setMessageType('error');
    }
  };

  // Handle Inventory Item Creation
  const handleCreateItem = async (e) => {
    e.preventDefault();
    if (!itemForm.main_category_id || !itemForm.sub_category_id) {
      setMessage('Please select both main category and sub category');
      setMessageType('error');
      return;
    }
    try {
      const result = await createInventoryItem({
        ...itemForm,
        sub_sub_category_id: itemForm.sub_sub_category_id || null,
        minimum_floor_stock: itemForm.minimum_floor_stock === '' ? 0 : itemForm.minimum_floor_stock,
        maximum_floor_stock: itemForm.maximum_floor_stock === '' ? 0 : itemForm.maximum_floor_stock,
        minimum_order_qty: itemForm.minimum_order_qty === '' ? 0 : itemForm.minimum_order_qty,
        maximum_order_qty: itemForm.maximum_order_qty === '' ? 0 : itemForm.maximum_order_qty,
        current_stock: itemForm.current_stock === '' ? 0 : itemForm.current_stock,
        created_by: userData.id || null,
      }).unwrap();
      if (result.status) {
        setMessage('Inventory Item created successfully');
        setMessageType('success');
        setItemForm({
          item_code: '',
          item_name: '',
          main_category_id: '',
          sub_category_id: '',
          sub_sub_category_id: '',
          unit: '',
          description: '',
          minimum_floor_stock: '',
          maximum_floor_stock: '',
          minimum_order_qty: '',
          maximum_order_qty: '',
          item_category: 's',
          current_stock: '',
          status: 'active',
        });
        setSelectedMainCategory('');
        setSelectedSubCategory('');
        setSelectedSubSubCategory('');
        setSelectedSubCategoryImage(null);
        refetchItems();
      }
    } catch (error) {
      setMessage(error?.data?.message || 'Failed to create inventory item');
      setMessageType('error');
    }
  };

  // Handle Item Update
  const handleUpdateItem = async (e) => {
    e.preventDefault();
    try {
      const result = await updateInventoryItem({
        id: selectedItem.id,
        ...itemForm,
        sub_sub_category_id: itemForm.sub_sub_category_id || null,
        minimum_floor_stock: itemForm.minimum_floor_stock === '' ? 0 : itemForm.minimum_floor_stock,
        maximum_floor_stock: itemForm.maximum_floor_stock === '' ? 0 : itemForm.maximum_floor_stock,
        minimum_order_qty: itemForm.minimum_order_qty === '' ? 0 : itemForm.minimum_order_qty,
        maximum_order_qty: itemForm.maximum_order_qty === '' ? 0 : itemForm.maximum_order_qty,
        current_stock: itemForm.current_stock === '' ? 0 : itemForm.current_stock,
        updated_by: userData.id || null,
      }).unwrap();
      if (result.status) {
        setMessage('Inventory Item updated successfully');
        setMessageType('success');
        setShowEditModal(false);
        setSelectedItem(null);
        refetchItems();
      }
    } catch (error) {
      setMessage(error?.data?.message || 'Failed to update inventory item');
      setMessageType('error');
    }
  };


  // Handle View Item
  const handleViewItem = (item) => {
    setSelectedItem(item);
    setShowViewModal(true);
  };

  // Handle Edit Item
  const handleEditItem = (item) => {
    setSelectedItem(item);
    setItemForm({
      item_code: item.item_code || '',
      item_name: item.item_name || '',
      main_category_id: item.main_category_id || '',
      sub_category_id: item.sub_category_id || '',
      sub_sub_category_id: item.sub_sub_category_id || '',
      unit: item.unit || '',
      description: item.description || '',
      minimum_floor_stock: item.minimum_floor_stock === 0 || item.minimum_floor_stock === null ? '' : item.minimum_floor_stock,
      maximum_floor_stock: item.maximum_floor_stock === 0 || item.maximum_floor_stock === null ? '' : item.maximum_floor_stock,
      minimum_order_qty: item.minimum_order_qty === 0 || item.minimum_order_qty === null ? '' : item.minimum_order_qty,
      maximum_order_qty: item.maximum_order_qty === 0 || item.maximum_order_qty === null ? '' : item.maximum_order_qty,
      item_category: item.item_category || 's',
      current_stock: item.current_stock === 0 || item.current_stock === null ? '' : item.current_stock,
      status: item.status || 'active',
    });
    setSelectedMainCategory(item.main_category_id || '');
    setSelectedSubCategory(item.sub_category_id || '');
    setSelectedSubSubCategory(item.sub_sub_category_id || '');
    setShowEditModal(true);
  };

  return (
    <div className={`inventory-items-registration-container${embedded ? ' inventory-items-registration-container--embedded' : ''}`}>
      {embedded ? (
        <AdminSubTabs tabs={INNER_TABS} active={activeTab} onChange={setActiveTab} />
      ) : (
        <div className="main-tabs-container-inventory-items">
          <button
            type="button"
            className={`main-tab-inventory-items ${activeTab === 'registration' ? 'active' : ''}`}
            onClick={() => setActiveTab('registration')}
          >
            <FaClipboardList className="main-tab-icon-inventory-items" />
            <span>Registration</span>
          </button>
          <button
            type="button"
            className={`main-tab-inventory-items ${activeTab === 'items' ? 'active' : ''}`}
            onClick={() => setActiveTab('items')}
          >
            <FaList className="main-tab-icon-inventory-items" />
            <span>Registered Item List</span>
          </button>
        </div>
      )}

      {/* Tab Content */}
      <div className="main-tab-content-inventory-items admin-stock-body">
        {message && (
          <div className={`message-inventory-items ${messageType} admin-stock-msg ${messageType === 'success' ? 'admin-stock-msg--ok' : 'admin-stock-msg--error'}`}>
            {message}
          </div>
        )}

        {activeTab === 'registration' && (
          <div className="registration-section-inventory-items admin-stock-panel">
        <form className="form-inventory-items-registration" onSubmit={handleCreateItem}>
          <div className="form-row-inventory-items">
            <div className="form-group-inventory-items-registration">
              <label className="label-inventory-items-registration" htmlFor="main_category">
                Main Category <span className="required-inventory-items-registration">*</span>
              </label>
              <div className="input-with-button-inventory-items">
                <select
                  id="main_category"
                  className="select-inventory-items-registration"
                  value={itemForm.main_category_id}
                  onChange={(e) => {
                    setItemForm((prev) => ({ ...prev, main_category_id: e.target.value }));
                    setSelectedMainCategory(e.target.value);
                  }}
                  required
                >
                  <option value="">Select Main Category</option>
                  {mainCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.category_name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-add-category-inventory-items"
                  onClick={() => setShowMainCategoryModal(true)}
                  title="Add Main Category"
                >
                  <FaPlus /> Add Main Category
                </button>
              </div>
            </div>

            <div className="form-group-inventory-items-registration">
              <label className="label-inventory-items-registration" htmlFor="sub_category">
                Sub Category <span className="required-inventory-items-registration">*</span>
              </label>
              <div className="input-with-button-inventory-items">
                <select
                  id="sub_category"
                  className="select-inventory-items-registration"
                  value={itemForm.sub_category_id}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    setItemForm((prev) => ({ ...prev, sub_category_id: selectedId }));
                    setSelectedSubCategory(selectedId);
                    // Find the selected subcategory and check for image
                    const selectedSub = subCategories.find((sub) => sub.id === parseInt(selectedId));
                    if (selectedSub && selectedSub.image_url) {
                      setSelectedSubCategoryImage(selectedSub.image_url);
                    } else {
                      setSelectedSubCategoryImage(null);
                    }
                  }}
                  required
                  disabled={!itemForm.main_category_id}
                >
                  <option value="">Select Sub Category</option>
                  {subCategories
                    .filter((sub) => sub.main_category_id === parseInt(itemForm.main_category_id))
                    .map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.sub_category_name}
                      </option>
                    ))}
                </select>
                {selectedSubCategoryImage && (
                  <button
                    type="button"
                    className="btn-view-category-inventory-items"
                    onClick={() => setShowSubCategoryImageModal(true)}
                    title="View Sub Category Image"
                  >
                    <FaEye /> View
                  </button>
                )}
                <button
                  type="button"
                  className="btn-add-category-inventory-items"
                  onClick={() => {
                    setSubCategoryForm((prev) => ({
                      ...prev,
                      main_category_id: itemForm.main_category_id,
                    }));
                    setShowSubCategoryModal(true);
                  }}
                  title="Add Sub Category"
                  disabled={!itemForm.main_category_id}
                >
                  <FaPlus /> Add Sub Category
                </button>
              </div>
            </div>
          </div>

          <div className="form-row-inventory-items">
            <div className="form-group-inventory-items-registration">
              <label className="label-inventory-items-registration" htmlFor="sub_sub_category">
                Sub-Sub Category <span style={{ fontSize: '11px', color: '#999', fontWeight: 'normal' }}>(Optional)</span>
              </label>
              <div className="input-with-button-inventory-items">
                <select
                  id="sub_sub_category"
                  className="select-inventory-items-registration"
                  value={itemForm.sub_sub_category_id}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    setItemForm((prev) => ({ ...prev, sub_sub_category_id: selectedId }));
                    setSelectedSubSubCategory(selectedId);
                  }}
                  disabled={!itemForm.sub_category_id}
                >
                  <option value="">Select Sub-Sub Category</option>
                  {subSubCategories
                    .filter((ssc) => ssc.sub_category_id === parseInt(itemForm.sub_category_id))
                    .map((ssc) => (
                      <option key={ssc.id} value={ssc.id}>
                        {ssc.sub_sub_category_name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="btn-add-category-inventory-items"
                  onClick={() => {
                    setSubSubCategoryForm((prev) => ({
                      ...prev,
                      sub_category_id: itemForm.sub_category_id,
                    }));
                    setShowSubSubCategoryModal(true);
                  }}
                  title="Add Sub-Sub Category"
                  disabled={!itemForm.sub_category_id}
                >
                  <FaPlus /> Add Sub-Sub Category
                </button>
              </div>
            </div>
          </div>

          <div className="form-group-inventory-items-registration">
            <label className="label-inventory-items-registration" htmlFor="item_name">
              Add Item <span className="required-inventory-items-registration">*</span>
            </label>
            <input
              type="text"
              id="item_name"
              className="input-inventory-items-registration"
              value={itemForm.item_name}
              onChange={(e) => setItemForm((prev) => ({ ...prev, item_name: e.target.value }))}
              required
            />
          </div>

          <div className="form-group-inventory-items-registration">
            <label className="label-inventory-items-registration">Select Item Category</label>
            <div className="checkbox-group-inventory-items">
              <label className="checkbox-label-inventory-items">
                <input
                  type="radio"
                  name="item_category"
                  value="a"
                  checked={itemForm.item_category === 'a'}
                  onChange={(e) => setItemForm((prev) => ({ ...prev, item_category: e.target.value }))}
                />
                <span>Assets Item</span>
              </label>
              <label className="checkbox-label-inventory-items">
                <input
                  type="radio"
                  name="item_category"
                  value="s"
                  checked={itemForm.item_category === 's'}
                  onChange={(e) => setItemForm((prev) => ({ ...prev, item_category: e.target.value }))}
                />
                <span>Stock Item</span>
              </label>
            </div>
          </div>

          <div className="form-row-inventory-items">
            <div className="form-group-inventory-items-registration">
              <label className="label-inventory-items-registration" htmlFor="item_code">
                Item Code <span className="required-inventory-items-registration">*</span>
                <span className="estimated-code-hint" style={{ fontSize: '12px', color: '#666', marginLeft: '8px', fontWeight: 'normal' }}>
                  (Auto-generated)
                </span>
              </label>
              <input
                type="text"
                id="item_code"
                className="input-inventory-items-registration"
                value={itemForm.item_code}
                readOnly
                required
              />
            </div>

          <div className="form-group-inventory-items-registration">
            <label className="label-inventory-items-registration" htmlFor="unit">
              Unit
            </label>
            <select
              id="unit"
              className="select-inventory-items-registration"
              value={itemForm.unit}
              onChange={(e) => setItemForm((prev) => ({ ...prev, unit: e.target.value }))}
            >
              <option value="">Select Unit</option>
              <option value="pcs">PCS</option>
              <option value="l">Liters</option>
              <option value="kg">Kilograms</option>
              <option value="m">Meters</option>
            </select>
          </div>
          </div>

          <div className="form-group-inventory-items-registration">
            <label className="label-inventory-items-registration" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              className="textarea-inventory-items-registration"
              value={itemForm.description}
              onChange={(e) => setItemForm((prev) => ({ ...prev, description: e.target.value }))}
              style={{ height: '80px', minHeight: '80px' }}
            />
          </div>

          <div className="form-row-inventory-items">
            <div className="form-group-inventory-items-registration">
              <label className="label-inventory-items-registration" htmlFor="minimum_floor_stock">
                Minimum Floor Stock
              </label>
              <input
                type="number"
                id="minimum_floor_stock"
                className="input-inventory-items-registration"
                value={itemForm.minimum_floor_stock === 0 || itemForm.minimum_floor_stock === '' ? '' : itemForm.minimum_floor_stock}
                onChange={(e) => setItemForm((prev) => ({ ...prev, minimum_floor_stock: e.target.value === '' ? '' : (isNaN(parseFloat(e.target.value)) ? '' : parseFloat(e.target.value)) }))}
                min="0"
                step="0.01"
              />
            </div>

            <div className="form-group-inventory-items-registration">
              <label className="label-inventory-items-registration" htmlFor="maximum_floor_stock">
                Maximum Floor Stock
              </label>
              <input
                type="number"
                id="maximum_floor_stock"
                className="input-inventory-items-registration"
                value={itemForm.maximum_floor_stock === 0 || itemForm.maximum_floor_stock === '' ? '' : itemForm.maximum_floor_stock}
                onChange={(e) => setItemForm((prev) => ({ ...prev, maximum_floor_stock: e.target.value === '' ? '' : (isNaN(parseFloat(e.target.value)) ? '' : parseFloat(e.target.value)) }))}
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div className="form-row-inventory-items">
            <div className="form-group-inventory-items-registration">
              <label className="label-inventory-items-registration" htmlFor="minimum_order_qty">
                Minimum Order Qty
              </label>
              <input
                type="number"
                id="minimum_order_qty"
                className="input-inventory-items-registration"
                value={itemForm.minimum_order_qty === 0 || itemForm.minimum_order_qty === '' ? '' : itemForm.minimum_order_qty}
                onChange={(e) => setItemForm((prev) => ({ ...prev, minimum_order_qty: e.target.value === '' ? '' : (isNaN(parseFloat(e.target.value)) ? '' : parseFloat(e.target.value)) }))}
                min="0"
                step="0.01"
              />
            </div>

            <div className="form-group-inventory-items-registration">
              <label className="label-inventory-items-registration" htmlFor="maximum_order_qty">
                Maximum Order Qty
              </label>
              <input
                type="number"
                id="maximum_order_qty"
                className="input-inventory-items-registration"
                value={itemForm.maximum_order_qty === 0 || itemForm.maximum_order_qty === '' ? '' : itemForm.maximum_order_qty}
                onChange={(e) => setItemForm((prev) => ({ ...prev, maximum_order_qty: e.target.value === '' ? '' : (isNaN(parseFloat(e.target.value)) ? '' : parseFloat(e.target.value)) }))}
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div className="form-row-inventory-items">
            <div className="form-group-inventory-items-registration">
              <label className="label-inventory-items-registration" htmlFor="current_stock">
                Current Stock
              </label>
              <input
                type="number"
                id="current_stock"
                className="input-inventory-items-registration"
                value={itemForm.current_stock === 0 || itemForm.current_stock === '' ? '' : itemForm.current_stock}
                onChange={(e) => setItemForm((prev) => ({ ...prev, current_stock: e.target.value === '' ? '' : (isNaN(parseFloat(e.target.value)) ? '' : parseFloat(e.target.value)) }))}
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div className="form-actions-inventory-items-registration">
            <button type="submit" className="btn-submit-inventory-items-registration">
              Add Item
            </button>
            <button
              type="button"
              className="btn-cancel-inventory-items-registration"
              onClick={() => {
                setItemForm({
                  item_code: '',
                  item_name: '',
                  main_category_id: '',
                  sub_category_id: '',
                  sub_sub_category_id: '',
                  unit: '',
                  description: '',
                  minimum_floor_stock: 0,
                  maximum_floor_stock: '',
                  minimum_order_qty: 0,
                  maximum_order_qty: 0,
                  item_category: 's',
                  current_stock: 0,
                  status: 'active',
                });
                setSelectedMainCategory('');
                setSelectedSubCategory('');
                setSelectedSubSubCategory('');
                setSelectedSubCategoryImage(null);
              }}
            >
              Clear
            </button>
          </div>
        </form>
          </div>
        )}

        {activeTab === 'items' && (
          <div className="registered-items-section-inventory-items">
            <div className="section-header-inventory-items">
              <h2 className="section-title-inventory-items">Registered Item List</h2>
              <div className="filters-container-inventory-items">
                <div className="filter-group-inventory-items">
                  <label className="filter-label-inventory-items">Main Category:</label>
                  <select
                    className="filter-select-inventory-items"
                    value={filterMainCategory}
                    onChange={(e) => setFilterMainCategory(e.target.value)}
                  >
                    <option value="">All Categories</option>
                    {mainCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.category_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="filter-group-inventory-items">
                  <label className="filter-label-inventory-items">Sub Category:</label>
                  <select
                    className="filter-select-inventory-items"
                    value={filterSubCategory}
                    onChange={(e) => setFilterSubCategory(e.target.value)}
                    disabled={!filterMainCategory}
                  >
                    <option value="">All Sub Categories</option>
                    {allSubCategories
                      .filter((sub) => sub.main_category_id === parseInt(filterMainCategory))
                      .map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.sub_category_name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="filter-group-inventory-items">
                  <label className="filter-label-inventory-items">Sub-Sub Category:</label>
                  <select
                    className="filter-select-inventory-items"
                    value={filterSubSubCategory}
                    onChange={(e) => setFilterSubSubCategory(e.target.value)}
                    disabled={!filterSubCategory}
                  >
                    <option value="">All Sub-Sub Categories</option>
                    {allSubSubCategories
                      .filter((ssc) => ssc.sub_category_id === parseInt(filterSubCategory))
                      .map((ssc) => (
                        <option key={ssc.id} value={ssc.id}>
                          {ssc.sub_sub_category_name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="filter-group-inventory-items">
                  <label className="filter-label-inventory-items">Item Category:</label>
                  <select
                    className="filter-select-inventory-items"
                    value={filterItemCategory}
                    onChange={(e) => setFilterItemCategory(e.target.value)}
                  >
                    <option value="">All Types</option>
                    <option value="a">Assets Item</option>
                    <option value="s">Stock Item</option>
                  </select>
                </div>
                <div className="search-container-inventory-items">
                  <label className="search-label-inventory-items">Search Item:</label>
                  <input
                    type="text"
                    className="search-input-inventory-items"
                    placeholder="Search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {(filterMainCategory || filterSubCategory || filterSubSubCategory || filterItemCategory || searchTerm) && (
                  <button
                    type="button"
                    className="btn-clear-filters-inventory-items"
                    onClick={() => {
                      setFilterMainCategory('');
                      setFilterSubCategory('');
                      setFilterSubSubCategory('');
                      setFilterItemCategory('');
                      setSearchTerm('');
                    }}
                    title="Clear All Filters"
                  >
                    <FaTimes /> Clear Filters
                  </button>
                )}
              </div>
            </div>

        {isLoading ? (
          <div className="loading-inventory-items">Loading items...</div>
        ) : error ? (
          <div className="error-inventory-items">Error loading items. Please refresh the page.</div>
        ) : filteredItems.length === 0 ? (
          <div className="no-data-inventory-items">
            {searchTerm ? 'No items found matching your search.' : 'No items found.'}
          </div>
        ) : (
          <table className="items-table-inventory-items">
            <thead>
              <tr>
                <th>ID</th>
                <th>Main Category</th>
                <th>Sub Category</th>
                <th>Sub-Sub Category</th>
                <th>Item</th>
                <th>Item Category</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id}>
                  <td>#{String(item.id).padStart(3, '0')}</td>
                  <td>{item.main_category_name || '-'}</td>
                  <td>{item.sub_category_name || '-'}</td>
                  <td>{item.sub_sub_category_name || '-'}</td>
                  <td>{item.item_name || '-'}</td>
                  <td>
                    <span className={`item-category-badge-inventory-items ${item.item_category === 's' ? 'stock-item' : 'inventory-item'}`}>
                      {item.item_category === 's' ? 'Stock Item' : 'Assets Item'}
                    </span>
                  </td>
                  <td className="actions-inventory-items">
                    <button
                      onClick={() => handleViewItem(item)}
                      className="action-btn-inventory-items view-inventory-items"
                      title="View Details"
                    >
                      <FaEye />
                    </button>
                    <button
                      onClick={() => handleEditItem(item)}
                      className="action-btn-inventory-items edit-inventory-items"
                      title="Edit Item"
                    >
                      <FaEdit />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
          </div>
        )}
      </div>

      {/* Main Category Modal */}
      {showMainCategoryModal && (
        <div className="modal-overlay-inventory-items" onClick={() => setShowMainCategoryModal(false)}>
          <div className="modal-content-inventory-items" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-inventory-items">
              <h2>Add Main Category</h2>
              <button
                type="button"
                className="close-btn-inventory-items"
                onClick={() => setShowMainCategoryModal(false)}
              >
                <FaTimes />
              </button>
            </div>
            <form className="modal-body-inventory-items" onSubmit={handleCreateMainCategory}>
              <div className="form-group-inventory-items-registration">
                <label className="label-inventory-items-registration" htmlFor="main_category_code">
                  Category Code <span className="required-inventory-items-registration">*</span>
                  <span className="estimated-code-hint" style={{ fontSize: '12px', color: '#666', marginLeft: '8px', fontWeight: 'normal' }}>
                    (Auto-generated)
                  </span>
                </label>
                <input
                  type="text"
                  id="main_category_code"
                  className="input-inventory-items-registration"
                  value={mainCategoryForm.category_code || ''}
                  readOnly
                  disabled
                  style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                  required
                />
              </div>
              <div className="form-group-inventory-items-registration">
                <label className="label-inventory-items-registration" htmlFor="main_category_name">
                  Category Name <span className="required-inventory-items-registration">*</span>
                </label>
                <input
                  type="text"
                  id="main_category_name"
                  className="input-inventory-items-registration"
                  value={mainCategoryForm.category_name}
                  onChange={(e) => setMainCategoryForm((prev) => ({ ...prev, category_name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group-inventory-items-registration">
                <label className="label-inventory-items-registration" htmlFor="main_category_description">
                  Description
                </label>
                <textarea
                  id="main_category_description"
                  className="textarea-inventory-items-registration"
                  value={mainCategoryForm.description}
                  onChange={(e) => setMainCategoryForm((prev) => ({ ...prev, description: e.target.value }))}
                  style={{ height: '80px', minHeight: '80px' }}
                />
              </div>
              <div className="modal-footer-inventory-items">
                <button type="submit" className="btn-submit-inventory-items-registration">
                  Add Main Category
                </button>
                <button
                  type="button"
                  className="btn-cancel-inventory-items-registration"
                  onClick={() => setShowMainCategoryModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sub Category Modal */}
      {showSubCategoryModal && (
        <div className="modal-overlay-inventory-items" onClick={() => setShowSubCategoryModal(false)}>
          <div className="modal-content-inventory-items" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-inventory-items">
              <h2>Add Sub Category</h2>
              <button
                type="button"
                className="close-btn-inventory-items"
                onClick={() => setShowSubCategoryModal(false)}
              >
                <FaTimes />
              </button>
            </div>
            <form className="modal-body-inventory-items" onSubmit={handleCreateSubCategory}>
              <div className="form-group-inventory-items-registration">
                <label className="label-inventory-items-registration" htmlFor="sub_category_main">
                  Main Category <span className="required-inventory-items-registration">*</span>
                </label>
                <select
                  id="sub_category_main"
                  className="select-inventory-items-registration"
                  value={subCategoryForm.main_category_id}
                  onChange={(e) => setSubCategoryForm((prev) => ({ ...prev, main_category_id: e.target.value }))}
                  required
                >
                  <option value="">Select Main Category</option>
                  {mainCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.category_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group-inventory-items-registration">
                <label className="label-inventory-items-registration" htmlFor="sub_category_code">
                  Sub Category Code <span className="required-inventory-items-registration">*</span>
                  <span className="estimated-code-hint" style={{ fontSize: '12px', color: '#666', marginLeft: '8px', fontWeight: 'normal' }}>
                    (Auto-generated)
                  </span>
                </label>
                <input
                  type="text"
                  id="sub_category_code"
                  className="input-inventory-items-registration"
                  value={subCategoryForm.sub_category_code || ''}
                  readOnly
                  disabled
                  style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                  required
                />
              </div>
              <div className="form-group-inventory-items-registration">
                <label className="label-inventory-items-registration" htmlFor="sub_category_name">
                  Sub Category Name <span className="required-inventory-items-registration">*</span>
                </label>
                <input
                  type="text"
                  id="sub_category_name"
                  className="input-inventory-items-registration"
                  value={subCategoryForm.sub_category_name}
                  onChange={(e) => setSubCategoryForm((prev) => ({ ...prev, sub_category_name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group-inventory-items-registration">
                <label className="label-inventory-items-registration" htmlFor="sub_category_image">
                  Image
                </label>
                <input
                  type="file"
                  id="sub_category_image"
                  accept="image/*"
                  className="input-inventory-items-registration"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setSubCategoryForm((prev) => ({
                          ...prev,
                          image: file,
                          imagePreview: reader.result,
                        }));
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                {subCategoryForm.imagePreview && (
                  <div style={{ marginTop: '10px' }}>
                    <img
                      src={subCategoryForm.imagePreview}
                      alt="Preview"
                      style={{
                        maxWidth: '200px',
                        maxHeight: '200px',
                        borderRadius: '8px',
                        border: '2px solid #e1e8ed',
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="form-group-inventory-items-registration">
                <label className="label-inventory-items-registration" htmlFor="sub_category_description">
                  Description
                </label>
                <textarea
                  id="sub_category_description"
                  className="textarea-inventory-items-registration"
                  value={subCategoryForm.description}
                  onChange={(e) => setSubCategoryForm((prev) => ({ ...prev, description: e.target.value }))}
                  style={{ height: '80px', minHeight: '80px' }}
                />
              </div>
              <div className="modal-footer-inventory-items">
                <button type="submit" className="btn-submit-inventory-items-registration">
                  Add Sub Category
                </button>
                <button
                  type="button"
                  className="btn-cancel-inventory-items-registration"
                  onClick={() => setShowSubCategoryModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sub-Sub Category Modal */}
      {showSubSubCategoryModal && (
        <div className="modal-overlay-inventory-items" onClick={() => setShowSubSubCategoryModal(false)}>
          <div className="modal-content-inventory-items" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-inventory-items">
              <h2>Add Sub-Sub Category</h2>
              <button
                type="button"
                className="close-btn-inventory-items"
                onClick={() => setShowSubSubCategoryModal(false)}
              >
                <FaTimes />
              </button>
            </div>
            <form className="modal-body-inventory-items" onSubmit={handleCreateSubSubCategory}>
              <div className="form-group-inventory-items-registration">
                <label className="label-inventory-items-registration" htmlFor="sub_sub_category_parent">
                  Sub Category <span className="required-inventory-items-registration">*</span>
                </label>
                <select
                  id="sub_sub_category_parent"
                  className="select-inventory-items-registration"
                  value={subSubCategoryForm.sub_category_id}
                  onChange={(e) => setSubSubCategoryForm((prev) => ({ ...prev, sub_category_id: e.target.value }))}
                  required
                >
                  <option value="">Select Sub Category</option>
                  {subCategories.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.sub_category_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group-inventory-items-registration">
                <label className="label-inventory-items-registration" htmlFor="sub_sub_category_code">
                  Sub-Sub Category Code <span className="required-inventory-items-registration">*</span>
                  <span className="estimated-code-hint" style={{ fontSize: '12px', color: '#666', marginLeft: '8px', fontWeight: 'normal' }}>
                    (Auto-generated)
                  </span>
                </label>
                <input
                  type="text"
                  id="sub_sub_category_code"
                  className="input-inventory-items-registration"
                  value={subSubCategoryForm.sub_sub_category_code || ''}
                  readOnly
                  disabled
                  style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                  required
                />
              </div>
              <div className="form-group-inventory-items-registration">
                <label className="label-inventory-items-registration" htmlFor="sub_sub_category_name">
                  Sub-Sub Category Name <span className="required-inventory-items-registration">*</span>
                </label>
                <input
                  type="text"
                  id="sub_sub_category_name"
                  className="input-inventory-items-registration"
                  value={subSubCategoryForm.sub_sub_category_name}
                  onChange={(e) => setSubSubCategoryForm((prev) => ({ ...prev, sub_sub_category_name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group-inventory-items-registration">
                <label className="label-inventory-items-registration" htmlFor="sub_sub_category_image">
                  Image
                </label>
                <input
                  type="file"
                  id="sub_sub_category_image"
                  accept="image/*"
                  className="input-inventory-items-registration"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setSubSubCategoryForm((prev) => ({
                          ...prev,
                          image: file,
                          imagePreview: reader.result,
                        }));
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                {subSubCategoryForm.imagePreview && (
                  <div style={{ marginTop: '10px' }}>
                    <img
                      src={subSubCategoryForm.imagePreview}
                      alt="Preview"
                      style={{
                        maxWidth: '200px',
                        maxHeight: '200px',
                        borderRadius: '8px',
                        border: '2px solid #e1e8ed',
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="form-group-inventory-items-registration">
                <label className="label-inventory-items-registration" htmlFor="sub_sub_category_description">
                  Description
                </label>
                <textarea
                  id="sub_sub_category_description"
                  className="textarea-inventory-items-registration"
                  value={subSubCategoryForm.description}
                  onChange={(e) => setSubSubCategoryForm((prev) => ({ ...prev, description: e.target.value }))}
                  style={{ height: '80px', minHeight: '80px' }}
                />
              </div>
              <div className="modal-footer-inventory-items">
                <button type="submit" className="btn-submit-inventory-items-registration">
                  Add Sub-Sub Category
                </button>
                <button
                  type="button"
                  className="btn-cancel-inventory-items-registration"
                  onClick={() => setShowSubSubCategoryModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Item Modal */}
      {showViewModal && selectedItem && (
        <div className="modal-overlay-inventory-items" onClick={() => setShowViewModal(false)}>
          <div className="modal-content-inventory-items large-modal-inventory-items" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-inventory-items">
              <h2>Item Details</h2>
              <button
                type="button"
                className="close-btn-inventory-items"
                onClick={() => setShowViewModal(false)}
              >
                <FaTimes />
              </button>
            </div>
            <div className="modal-body-inventory-items">
              <div className="detail-grid-inventory-items">
                <div className="detail-row-inventory-items">
                  <span className="detail-label-inventory-items">Item Code:</span>
                  <span className="detail-value-inventory-items">{selectedItem.item_code || '-'}</span>
                </div>
                <div className="detail-row-inventory-items">
                  <span className="detail-label-inventory-items">Item Name:</span>
                  <span className="detail-value-inventory-items">{selectedItem.item_name || '-'}</span>
                </div>
                <div className="detail-row-inventory-items">
                  <span className="detail-label-inventory-items">Main Category:</span>
                  <span className="detail-value-inventory-items">{selectedItem.main_category_name || '-'}</span>
                </div>
                <div className="detail-row-inventory-items">
                  <span className="detail-label-inventory-items">Sub Category:</span>
                  <span className="detail-value-inventory-items">{selectedItem.sub_category_name || '-'}</span>
                </div>
                <div className="detail-row-inventory-items">
                  <span className="detail-label-inventory-items">Sub-Sub Category:</span>
                  <span className="detail-value-inventory-items">{selectedItem.sub_sub_category_name || '-'}</span>
                </div>
                <div className="detail-row-inventory-items">
                  <span className="detail-label-inventory-items">Item Category:</span>
                  <span className={`detail-value-inventory-items item-category-badge-inventory-items ${selectedItem.item_category === 's' ? 'stock-item' : 'inventory-item'}`}>
                    {selectedItem.item_category === 's' ? 'Stock Item' : 'Inventory Item'}
                  </span>
                </div>
                <div className="detail-row-inventory-items">
                  <span className="detail-label-inventory-items">Unit:</span>
                  <span className="detail-value-inventory-items">{selectedItem.unit || '-'}</span>
                </div>
                <div className="detail-row-inventory-items">
                  <span className="detail-label-inventory-items">Description:</span>
                  <span className="detail-value-inventory-items">{selectedItem.description || '-'}</span>
                </div>
                <div className="detail-row-inventory-items">
                  <span className="detail-label-inventory-items">Minimum Floor Stock:</span>
                  <span className="detail-value-inventory-items">{selectedItem.minimum_floor_stock || 0}</span>
                </div>
                <div className="detail-row-inventory-items">
                  <span className="detail-label-inventory-items">Maximum Floor Stock:</span>
                  <span className="detail-value-inventory-items">{selectedItem.maximum_floor_stock || 0}</span>
                </div>
                <div className="detail-row-inventory-items">
                  <span className="detail-label-inventory-items">Minimum Order Qty:</span>
                  <span className="detail-value-inventory-items">{selectedItem.minimum_order_qty || 0}</span>
                </div>
                <div className="detail-row-inventory-items">
                  <span className="detail-label-inventory-items">Maximum Order Qty:</span>
                  <span className="detail-value-inventory-items">{selectedItem.maximum_order_qty || 0}</span>
                </div>
                <div className="detail-row-inventory-items">
                  <span className="detail-label-inventory-items">Current Stock:</span>
                  <span className="detail-value-inventory-items">{selectedItem.current_stock || 0}</span>
                </div>
                <div className="detail-row-inventory-items">
                  <span className="detail-label-inventory-items">Status:</span>
                  <span className={`detail-value-inventory-items status-badge-inventory-items ${selectedItem.status === 'active' ? 'status-active-inventory-items' : 'status-inactive-inventory-items'}`}>
                    {selectedItem.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
            <div className="modal-footer-inventory-items">
              <button
                type="button"
                className="btn-edit-modal-inventory-items"
                onClick={() => {
                  setShowViewModal(false);
                  handleEditItem(selectedItem);
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn-close-modal-inventory-items"
                onClick={() => setShowViewModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {showEditModal && selectedItem && (
        <div className="modal-overlay-inventory-items" onClick={() => setShowEditModal(false)}>
          <div className="modal-content-inventory-items large-modal-inventory-items" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-inventory-items">
              <h2>Edit Item</h2>
              <button
                type="button"
                className="close-btn-inventory-items"
                onClick={() => setShowEditModal(false)}
              >
                <FaTimes />
              </button>
            </div>
            <form className="modal-body-inventory-items" onSubmit={handleUpdateItem}>
              <div className="form-row-inventory-items">
                <div className="form-group-inventory-items-registration">
                  <label className="label-inventory-items-registration" htmlFor="edit_item_code">
                    Item Code
                  </label>
                  <input
                    type="text"
                    id="edit_item_code"
                    className="input-inventory-items-registration"
                    value={itemForm.item_code}
                    onChange={(e) => setItemForm((prev) => ({ ...prev, item_code: e.target.value }))}
                    readOnly
                  />
                </div>
                <div className="form-group-inventory-items-registration">
                  <label className="label-inventory-items-registration" htmlFor="edit_unit">
                    Unit
                  </label>
                  <select
                    id="edit_unit"
                    className="select-inventory-items-registration"
                    value={itemForm.unit}
                    onChange={(e) => setItemForm((prev) => ({ ...prev, unit: e.target.value }))}
                  >
                    <option value="">Select Unit</option>
                    <option value="pcs">PCS</option>
                    <option value="l">Liters</option>
                    <option value="kg">Kilograms</option>
                    <option value="m">Meters</option>
                  </select>
                </div>
              </div>
              <div className="form-group-inventory-items-registration">
                <label className="label-inventory-items-registration" htmlFor="edit_item_name">
                  Item Name <span className="required-inventory-items-registration">*</span>
                </label>
                <input
                  type="text"
                  id="edit_item_name"
                  className="input-inventory-items-registration"
                  value={itemForm.item_name}
                  onChange={(e) => setItemForm((prev) => ({ ...prev, item_name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-row-inventory-items">
                <div className="form-group-inventory-items-registration">
                  <label className="label-inventory-items-registration" htmlFor="edit_main_category">
                    Main Category <span className="required-inventory-items-registration">*</span>
                  </label>
                  <select
                    id="edit_main_category"
                    className="select-inventory-items-registration"
                    value={itemForm.main_category_id}
                    onChange={(e) => {
                      setItemForm((prev) => ({ ...prev, main_category_id: e.target.value, sub_category_id: '', sub_sub_category_id: '' }));
                      setSelectedMainCategory(e.target.value);
                      setSelectedSubCategoryImage(null);
                    }}
                    required
                  >
                    <option value="">Select Main Category</option>
                    {mainCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.category_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group-inventory-items-registration">
                  <label className="label-inventory-items-registration" htmlFor="edit_sub_category">
                    Sub Category <span className="required-inventory-items-registration">*</span>
                  </label>
                  <select
                    id="edit_sub_category"
                    className="select-inventory-items-registration"
                    value={itemForm.sub_category_id}
                    onChange={(e) => {
                      setItemForm((prev) => ({ ...prev, sub_category_id: e.target.value, sub_sub_category_id: '' }));
                      setSelectedSubCategory(e.target.value);
                    }}
                    required
                    disabled={!itemForm.main_category_id}
                  >
                    <option value="">Select Sub Category</option>
                    {subCategories
                      .filter((sub) => sub.main_category_id === parseInt(itemForm.main_category_id))
                      .map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.sub_category_name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="form-row-inventory-items">
                <div className="form-group-inventory-items-registration">
                  <label className="label-inventory-items-registration" htmlFor="edit_sub_sub_category">
                    Sub-Sub Category <span style={{ fontSize: '11px', color: '#999', fontWeight: 'normal' }}>(Optional)</span>
                  </label>
                  <select
                    id="edit_sub_sub_category"
                    className="select-inventory-items-registration"
                    value={itemForm.sub_sub_category_id}
                    onChange={(e) => {
                      setItemForm((prev) => ({ ...prev, sub_sub_category_id: e.target.value }));
                      setSelectedSubSubCategory(e.target.value);
                    }}
                    disabled={!itemForm.sub_category_id}
                  >
                    <option value="">Select Sub-Sub Category</option>
                    {subSubCategories
                      .filter((ssc) => ssc.sub_category_id === parseInt(itemForm.sub_category_id))
                      .map((ssc) => (
                        <option key={ssc.id} value={ssc.id}>
                          {ssc.sub_sub_category_name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="form-group-inventory-items-registration">
                <label className="label-inventory-items-registration">Item Category</label>
                <div className="checkbox-group-inventory-items">
                  <label className="checkbox-label-inventory-items">
                    <input
                      type="radio"
                      name="edit_item_category"
                      value="i"
                      checked={itemForm.item_category === 'i'}
                      onChange={(e) => setItemForm((prev) => ({ ...prev, item_category: e.target.value }))}
                    />
                    <span>Inventory Item</span>
                  </label>
                  <label className="checkbox-label-inventory-items">
                    <input
                      type="radio"
                      name="edit_item_category"
                      value="s"
                      checked={itemForm.item_category === 's'}
                      onChange={(e) => setItemForm((prev) => ({ ...prev, item_category: e.target.value }))}
                    />
                    <span>Stock Item</span>
                  </label>
                </div>
              </div>
              <div className="form-group-inventory-items-registration">
                <label className="label-inventory-items-registration" htmlFor="edit_description">
                  Description
                </label>
                <textarea
                  id="edit_description"
                  className="textarea-inventory-items-registration"
                  value={itemForm.description}
                  onChange={(e) => setItemForm((prev) => ({ ...prev, description: e.target.value }))}
                  style={{ height: '80px', minHeight: '80px' }}
                />
              </div>
              <div className="form-row-inventory-items">
                <div className="form-group-inventory-items-registration">
                  <label className="label-inventory-items-registration" htmlFor="edit_minimum_floor_stock">
                    Minimum Floor Stock
                  </label>
                  <input
                    type="number"
                    id="edit_minimum_floor_stock"
                    className="input-inventory-items-registration"
                    value={itemForm.minimum_floor_stock === 0 || itemForm.minimum_floor_stock === '' ? '' : itemForm.minimum_floor_stock}
                    onChange={(e) => setItemForm((prev) => ({ ...prev, minimum_floor_stock: e.target.value === '' ? '' : (isNaN(parseFloat(e.target.value)) ? '' : parseFloat(e.target.value)) }))}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="form-group-inventory-items-registration">
                  <label className="label-inventory-items-registration" htmlFor="edit_maximum_floor_stock">
                    Maximum Floor Stock
                  </label>
                  <input
                    type="number"
                    id="edit_maximum_floor_stock"
                    className="input-inventory-items-registration"
                    value={itemForm.maximum_floor_stock === 0 || itemForm.maximum_floor_stock === '' ? '' : itemForm.maximum_floor_stock}
                    onChange={(e) => setItemForm((prev) => ({ ...prev, maximum_floor_stock: e.target.value === '' ? '' : (isNaN(parseFloat(e.target.value)) ? '' : parseFloat(e.target.value)) }))}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div className="form-row-inventory-items">
                <div className="form-group-inventory-items-registration">
                  <label className="label-inventory-items-registration" htmlFor="edit_minimum_order_qty">
                    Minimum Order Qty
                  </label>
                  <input
                    type="number"
                    id="edit_minimum_order_qty"
                    className="input-inventory-items-registration"
                    value={itemForm.minimum_order_qty === 0 || itemForm.minimum_order_qty === '' ? '' : itemForm.minimum_order_qty}
                    onChange={(e) => setItemForm((prev) => ({ ...prev, minimum_order_qty: e.target.value === '' ? '' : (isNaN(parseFloat(e.target.value)) ? '' : parseFloat(e.target.value)) }))}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="form-group-inventory-items-registration">
                  <label className="label-inventory-items-registration" htmlFor="edit_maximum_order_qty">
                    Maximum Order Qty
                  </label>
                  <input
                    type="number"
                    id="edit_maximum_order_qty"
                    className="input-inventory-items-registration"
                    value={itemForm.maximum_order_qty === 0 || itemForm.maximum_order_qty === '' ? '' : itemForm.maximum_order_qty}
                    onChange={(e) => setItemForm((prev) => ({ ...prev, maximum_order_qty: e.target.value === '' ? '' : (isNaN(parseFloat(e.target.value)) ? '' : parseFloat(e.target.value)) }))}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div className="form-row-inventory-items">
                <div className="form-group-inventory-items-registration">
                  <label className="label-inventory-items-registration" htmlFor="edit_current_stock">
                    Current Stock
                  </label>
                  <input
                    type="number"
                    id="edit_current_stock"
                    className="input-inventory-items-registration"
                    value={itemForm.current_stock === 0 || itemForm.current_stock === '' ? '' : itemForm.current_stock}
                    onChange={(e) => setItemForm((prev) => ({ ...prev, current_stock: e.target.value === '' ? '' : (isNaN(parseFloat(e.target.value)) ? '' : parseFloat(e.target.value)) }))}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div className="form-group-inventory-items-registration">
                <label className="label-inventory-items-registration" htmlFor="edit_status">
                  Status
                </label>
                <select
                  id="edit_status"
                  className="select-inventory-items-registration"
                  value={itemForm.status}
                  onChange={(e) => setItemForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="modal-footer-inventory-items">
                <button type="submit" className="btn-submit-inventory-items-registration">
                  Update Item
                </button>
                <button
                  type="button"
                  className="btn-cancel-inventory-items-registration"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sub Category Image View Modal */}
      {showSubCategoryImageModal && selectedSubCategoryImage && (
        <div className="modal-overlay-inventory-items" onClick={() => setShowSubCategoryImageModal(false)}>
          <div className="modal-content-inventory-items image-modal-inventory-items" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-inventory-items">
              <h2>Sub Category Image</h2>
              <button
                type="button"
                className="close-btn-inventory-items"
                onClick={() => setShowSubCategoryImageModal(false)}
              >
                <FaTimes />
              </button>
            </div>
            <div className="modal-body-inventory-items image-modal-body-inventory-items">
              <img 
                src={selectedSubCategoryImage} 
                alt="Sub Category" 
                className="subcategory-full-image-inventory-items"
                onError={(e) => {
                  e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23ddd" width="400" height="300"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="20" dy="10.5" font-weight="bold" x="50%25" y="50%25" text-anchor="middle"%3EImage not found%3C/text%3E%3C/svg%3E';
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryItemsRegistration;
