import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../../styles/procurementProcessNew.css';
import { AdminStockPage, AdminSubTabs } from './shell/AdminStockShell';
import {
  useCreateGrnMutation,
  useCreateProcurementRequestMutation,
  useCreatePurchaseOrderMutation,
  useCreateRfqMutation,
  useCreateSupplierQuotationMutation,
  useFinalizeQuotationMutation,
  useGetApprovedProcureQueueQuery,
  useGetGrnsQuery,
  useLazyGetGrnQuery,
  useGetInventoryItemsQuery,
  useGetNeedToProcureQueueQuery,
  useGetPendingQuotationsQueueQuery,
  useGetProcurementRequestQuery,
  useLazyGetProcurementRequestQuery,
  useGetProcurementRequestsQuery,
  useGetPurchaseOrderQuery,
  useGetPurchaseOrdersQuery,
  useLazyGetPurchaseOrderQuery,
  useGetRfqsQuery,
  useGetSupplierQuotationsQuery,
  useLazyGetQuotationQuery,
  useGetSuppliersQuery,
  useSaveQuotationEvaluationMutation,
  useSaveTechnicalEvaluationMutation,
  useUpdateProcurementRequestStatusMutation,
} from '../../api/services NodeJs/allEndpoints';
import { getResourceUrl } from '../../utils/resourceUrls';
import { COMPANY } from '../../config/companyConstants';
import GRNDocument from './GRNDocument';

const TABS = [
  { key: 'requests', label: 'Procurement Requests', path: '/home/stock-assets/procurement-process/requests' },
  { key: 'approval', label: 'Procurement Approval', path: '/home/stock-assets/procurement-process/approve-requests' },
  { key: 'rfq', label: 'Request Quotations', path: '/home/stock-assets/procurement-process/request-quotations' },
  { key: 'submit-quotation', label: 'Submit Supplier Quotation', path: '/home/stock-assets/procurement-process/submit-quotation' },
  { key: 'eval', label: 'Quotations Evaluation', path: '/home/stock-assets/procurement-process/quotations-evaluation' },
  { key: 'tech', label: 'Tech Evaluation', path: '/home/stock-assets/procurement-process/tech-evaluation' },
  { key: 'finalize', label: 'Finalize Quotations', path: '/home/stock-assets/procurement-process/finalize-quotations' },
  { key: 'po', label: 'Purchasing Order Issue', path: '/home/stock-assets/procurement-process/purchase-order-issue' },
  { key: 'grn', label: 'Good Received Note', path: '/home/stock-assets/procurement-process/grn' },
];

const detectTabFromPath = (pathname) => {
  if (pathname.includes('/approve-requests')) return 'approval';
  if (pathname.includes('/request-quotations')) return 'rfq';
  if (pathname.includes('/submit-quotation') || pathname.includes('/pending-quotations')) return 'submit-quotation';
  if (pathname.includes('/quotations-evaluation')) return 'eval';
  if (pathname.includes('/tech-evaluation')) return 'tech';
  if (pathname.includes('/finalize-quotations')) return 'finalize';
  if (pathname.includes('/purchase-order-issue')) return 'po';
  if (pathname.includes('/grn')) return 'grn';
  return 'requests';
};

const formatDateDisplay = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-');
const formatDateTimeDisplay = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');

const ProcurementProcess = () => {
  const routerLocation = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(detectTabFromPath(routerLocation.pathname));
  const [isManualRequestModalOpen, setIsManualRequestModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    lineItems: [{ inventory_item_id: '', quantity: '' }],
    notes: '',
  });
  const [selectedNeedToProcure, setSelectedNeedToProcure] = useState({});
  const [selectedSuppliers, setSelectedSuppliers] = useState({});
  const [rfqForm, setRfqForm] = useState({ procurement_request_id: '', closing_date: '', closing_time: '' });
  const [selectedRfqId, setSelectedRfqId] = useState('');
  const [quotationForm, setQuotationForm] = useState({
    quotation_id: '',
    supplier_id: '',
    total_price: '',
    delivery_time_days: '',
    tax_rate: '',
    discount: '',
    scanned_file: null,
    existing_scanned_document: '',
    lineItems: [],
  });
  const [evaluationForm, setEvaluationForm] = useState({ quotation_id: '', score: '', comments: '' });
  const [techForm, setTechForm] = useState({ quotation_id: '', status: 'pending', comments: '' });
  const [finalizeQuotationId, setFinalizeQuotationId] = useState('');
  const [poForm, setPoForm] = useState({
    procurement_request_id: '',
    quotation_id: '',
    supplier_id: '',
    lineItems: [],
  });
  const [selectedPoId, setSelectedPoId] = useState('');
  const [grnItemMap, setGrnItemMap] = useState({});
  const [approvalItemsPopupRequestId, setApprovalItemsPopupRequestId] = useState(null);
  const [approvalRequestDetailsCache, setApprovalRequestDetailsCache] = useState({});
  const [fetchProcurementRequest, { isLoading: loadingRequestDetails }] = useLazyGetProcurementRequestQuery();
  const [grnForm, setGrnForm] = useState({
    received_at_location: '',
    supplier_invoice_no: '',
    supplier_invoice_date: '',
    delivery_note_waybill_no: '',
    vehicle_no_transport: '',
    received_by_name: '',
    received_by_designation: '',
    inspected_by_name: '',
    inspection_condition: 'good_condition',
    discrepancies_notes: '',
    shortage_excess_notes: '',
    verified_by_name: '',
    approved_by_name: '',
  });
  const [isPendingQuotationsPopupOpen, setIsPendingQuotationsPopupOpen] = useState(false);
  const [isProcurementItemsPopupOpen, setIsProcurementItemsPopupOpen] = useState(false);

  const { data: procurementRequests = [], refetch: refetchProcurementRequests } = useGetProcurementRequestsQuery({});
  const { data: approvedQueue = [], refetch: refetchApprovedQueue } = useGetApprovedProcureQueueQuery({});
  const { data: rfqs = [], refetch: refetchRfqs } = useGetRfqsQuery({});
  const { data: pendingQueue = [] } = useGetPendingQuotationsQueueQuery({});
  const rfqIdForQuotations = useMemo(() => {
    if (activeTab === 'po' && poForm.procurement_request_id) {
      const rfq = rfqs.find((r) => String(r.procurement_request_id) === String(poForm.procurement_request_id));
      return rfq?.id ? String(rfq.id) : null;
    }
    return selectedRfqId || null;
  }, [activeTab, poForm.procurement_request_id, rfqs, selectedRfqId]);
  const { data: quotations = [], refetch: refetchQuotations } = useGetSupplierQuotationsQuery(
    rfqIdForQuotations ? { rfq_id: rfqIdForQuotations } : {},
    { skip: !rfqIdForQuotations }
  );
  const finalizedQuotationForPo = useMemo(() => {
    if (activeTab !== 'po' || !quotations?.length) return null;
    return quotations.find((q) => q.status === 'selected') || null;
  }, [activeTab, quotations]);
  const finalizedProcurementsForPo = useMemo(() => {
    const fromRfqs = rfqs
      .filter((r) => String(r.status || '').toLowerCase() === 'finalized')
      .map((r) => ({
        id: r.procurement_request_id,
        procurement_no: r.procurement_no || r.rfq_no || `Procurement #${r.procurement_request_id}`,
      }));
    const fromRequests = procurementRequests.filter((x) => String(x.status || '').toLowerCase() === 'finalized');
    const merged = new Map();
    fromRfqs.forEach((p) => merged.set(String(p.id), p));
    fromRequests.forEach((p) => {
      const existing = merged.get(String(p.id));
      merged.set(String(p.id), {
        id: p.id,
        procurement_no: p.procurement_no || existing?.procurement_no || `Procurement #${p.id}`,
      });
    });
    return Array.from(merged.values());
  }, [rfqs, procurementRequests]);
  const selectedProcurementNoForPo = useMemo(() => {
    const row = finalizedProcurementsForPo.find((r) => String(r.id) === String(poForm.procurement_request_id));
    return row?.procurement_no ?? null;
  }, [finalizedProcurementsForPo, poForm.procurement_request_id]);
  const { data: needToProcureQueue = [], refetch: refetchNeedQueue } = useGetNeedToProcureQueueQuery({});
  const { data: suppliers = [] } = useGetSuppliersQuery({});
  const { data: inventoryItems = [] } = useGetInventoryItemsQuery({});
  const { data: purchaseOrders = [], refetch: refetchPurchaseOrders } = useGetPurchaseOrdersQuery(
    {},
    { refetchOnMountOrArgChange: true }
  );
  const selectedProcurementFullyReceived = useMemo(() => {
    if (!selectedProcurementNoForPo) return false;
    return purchaseOrders.some(
      (po) => String(po.procurement_no) === String(selectedProcurementNoForPo) && String(po.status).toLowerCase() === 'received'
    );
  }, [purchaseOrders, selectedProcurementNoForPo]);
  const { data: selectedPurchaseOrder, refetch: refetchSelectedPo } = useGetPurchaseOrderQuery(selectedPoId, {
    skip: !selectedPoId,
    refetchOnMountOrArgChange: true,
  });
  const { data: grns = [], refetch: refetchGrns } = useGetGrnsQuery({});
  const { data: selectedProcurementRequest } = useGetProcurementRequestQuery(poForm.procurement_request_id, {
    skip: !poForm.procurement_request_id,
  });

  const selectedRfq = useMemo(
    () => rfqs.find((r) => String(r.id) === String(selectedRfqId)),
    [rfqs, selectedRfqId]
  );
  const selectedRfqProcurementId = useMemo(() => selectedRfq?.procurement_request_id || null, [selectedRfq]);

  const { data: selectedRfqProcurementRequest } = useGetProcurementRequestQuery(selectedRfqProcurementId, {
    skip: !selectedRfqProcurementId,
  });

  const { data: rfqSelectedProcurement } = useGetProcurementRequestQuery(rfqForm.procurement_request_id, {
    skip: !rfqForm.procurement_request_id || activeTab !== 'rfq',
  });

  const [createProcurementRequest, { isLoading: creatingProcRequest }] = useCreateProcurementRequestMutation();
  const [updateProcurementRequestStatus] = useUpdateProcurementRequestStatusMutation();
  const [createRfq, { isLoading: creatingRfq }] = useCreateRfqMutation();
  const [createSupplierQuotation, { isLoading: creatingQuotation }] = useCreateSupplierQuotationMutation();
  const [fetchQuotationById] = useLazyGetQuotationQuery();
  const [saveQuotationEvaluation] = useSaveQuotationEvaluationMutation();
  const [saveTechnicalEvaluation] = useSaveTechnicalEvaluationMutation();
  const [finalizeQuotation] = useFinalizeQuotationMutation();
  const [createPurchaseOrder, { isLoading: creatingPo }] = useCreatePurchaseOrderMutation();
  const [createGrn, { isLoading: creatingGrn }] = useCreateGrnMutation();

  React.useEffect(() => {
    setActiveTab(detectTabFromPath(routerLocation.pathname));
  }, [routerLocation.pathname]);

  React.useEffect(() => {
    if (activeTab === 'po') {
      refetchPurchaseOrders();
      refetchRfqs();
      refetchProcurementRequests();
    }
  }, [activeTab, refetchPurchaseOrders, refetchRfqs, refetchProcurementRequests]);

  // Default closing date (3 days from today) and time (00:00) when on RFQ tab
  React.useEffect(() => {
    if (activeTab === 'rfq' && !rfqForm.closing_date) {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      const dateStr = d.toISOString().slice(0, 10);
      setRfqForm((prev) => ({
        ...prev,
        closing_date: dateStr,
        closing_time: prev.closing_time || '00:00',
      }));
    }
  }, [activeTab, rfqForm.closing_date]);

  // When user selects a quotation for evaluation, show previous saved data if any
  React.useEffect(() => {
    if (!evaluationForm.quotation_id || !quotations?.length) return;
    const q = quotations.find((x) => String(x.id) === String(evaluationForm.quotation_id));
    if (q) {
      setEvaluationForm((prev) => ({
        ...prev,
        score: q.commercial_score != null ? String(q.commercial_score) : '',
        comments: q.commercial_comments || '',
      }));
    }
  }, [evaluationForm.quotation_id, quotations]);

  React.useEffect(() => {
    if (!techForm.quotation_id || !quotations?.length) return;
    const q = quotations.find((x) => String(x.id) === String(techForm.quotation_id));
    if (q) {
      setTechForm((prev) => ({
        ...prev,
        status: q.tech_status || 'pending',
        comments: q.tech_comments || '',
      }));
    }
  }, [techForm.quotation_id, quotations]);

  React.useEffect(() => {
    if (activeTab === 'po' && finalizedQuotationForPo && poForm.procurement_request_id) {
      setPoForm((prev) => ({
        ...prev,
        quotation_id: String(finalizedQuotationForPo.id),
        supplier_id: String(finalizedQuotationForPo.supplier_id),
      }));
    }
  }, [activeTab, finalizedQuotationForPo, poForm.procurement_request_id]);

  const poQuotationPricesAppliedRef = React.useRef(null);

  React.useEffect(() => {
    if (activeTab === 'po' && selectedProcurementRequest?.items?.length) {
      poQuotationPricesAppliedRef.current = null;
      setPoForm((prev) => ({
        ...prev,
        lineItems: selectedProcurementRequest.items.map((item) => ({
          inventory_item_id: item.inventory_item_id,
          item_code: item.item_code,
          item_name: item.item_name,
          quantity: item.quantity,
          unit_price: item.unit_price != null ? String(item.unit_price) : '',
        })),
      }));
    }
  }, [activeTab, selectedProcurementRequest?.items]);

  React.useEffect(() => {
    if (activeTab !== 'po' || !finalizedQuotationForPo?.id || !poForm.lineItems?.length) return;
    if (poQuotationPricesAppliedRef.current === finalizedQuotationForPo.id) return;
    fetchQuotationById(finalizedQuotationForPo.id).then((res) => {
      const q = res?.data;
      if (!q?.items?.length) return;
      const priceMap = new Map(q.items.map((it) => [String(it.inventory_item_id), it.unit_price]));
      poQuotationPricesAppliedRef.current = finalizedQuotationForPo.id;
      setPoForm((prev) => ({
        ...prev,
        lineItems: prev.lineItems.map((li) => {
          const quotedPrice = priceMap.get(String(li.inventory_item_id));
          return {
            ...li,
            unit_price: quotedPrice != null ? String(quotedPrice) : li.unit_price,
          };
        }),
      }));
    });
  }, [activeTab, finalizedQuotationForPo?.id, poForm.lineItems?.length, fetchQuotationById]);

  React.useEffect(() => {
    if (activeTab === 'submit-quotation' && selectedRfqProcurementRequest?.items?.length) {
      setQuotationForm((prev) => ({
        ...prev,
        lineItems: selectedRfqProcurementRequest.items.map((item) => ({
          procurement_request_item_id: item.id,
          inventory_item_id: item.inventory_item_id,
          item_code: item.item_code,
          item_name: item.item_name,
          quantity: item.quantity,
          unit_price: item.unit_price != null ? String(item.unit_price) : '',
        })),
      }));
    }
  }, [activeTab, selectedRfqProcurementRequest?.items]);

  const selectedNeedIds = useMemo(
    () => Object.keys(selectedNeedToProcure).filter((id) => selectedNeedToProcure[id]).map(Number),
    [selectedNeedToProcure]
  );

  const selectedSupplierIds = useMemo(
    () => Object.keys(selectedSuppliers).filter((id) => selectedSuppliers[id]).map(Number),
    [selectedSuppliers]
  );
  const selectedSupplierOptionValues = useMemo(
    () => Object.keys(selectedSuppliers).filter((id) => selectedSuppliers[id]),
    [selectedSuppliers]
  );

  const supplierList = useMemo(() => {
    if (Array.isArray(suppliers)) return suppliers;
    if (Array.isArray(suppliers?.suppliers)) return suppliers.suppliers;
    if (Array.isArray(suppliers?.data)) return suppliers.data;
    return [];
  }, [suppliers]);

  // Suppliers who already submitted quotation for the selected RFQ (submit-quotation tab)
  const supplierIdsWithQuotation = useMemo(
    () => (quotations || []).map((q) => String(q.supplier_id)),
    [quotations]
  );
  const quotationBySupplierId = useMemo(
    () => new Map((quotations || []).map((q) => [String(q.supplier_id), q])),
    [quotations]
  );

  const pendingProcurementRequests = useMemo(
    () => procurementRequests.filter((row) => String(row.status || '').toLowerCase() === 'pending'),
    [procurementRequests]
  );

  const approvalHistory = useMemo(
    () => procurementRequests.filter(
      (row) => !['pending'].includes(String(row.status || '').toLowerCase())
    ),
    [procurementRequests]
  );

  const addManualFormRow = () => {
    setManualForm((prev) => ({
      ...prev,
      lineItems: [...prev.lineItems, { inventory_item_id: '', quantity: '' }],
    }));
  };

  const updateManualFormRow = (index, field, value) => {
    setManualForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((row, i) =>
        i === index ? { ...row, [field]: value } : row
      ),
    }));
  };

  const removeManualFormRow = (index) => {
    setManualForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.length > 1
        ? prev.lineItems.filter((_, i) => i !== index)
        : [{ inventory_item_id: '', quantity: '' }],
    }));
  };

  const resetManualForm = () => {
    setManualForm({
      lineItems: [{ inventory_item_id: '', quantity: '' }],
      notes: '',
    });
  };

  const handleViewApprovalRequestItems = async (requestId) => {
    const id = Number(requestId);
    setApprovalItemsPopupRequestId(id);
    if (approvalRequestDetailsCache[id]) return;
    try {
      const result = await fetchProcurementRequest(id);
      if (result?.data) {
        setApprovalRequestDetailsCache((prev) => ({ ...prev, [id]: result.data }));
      }
    } catch {
      alert('Failed to load request details');
    }
  };

  const handleCreateManualProcurement = async (e) => {
    e.preventDefault();
    const validItems = manualForm.lineItems.filter(
      (row) => row.inventory_item_id && Number(row.quantity) > 0
    );
    if (!validItems.length) {
      alert('Add at least one item with quantity');
      return;
    }
    try {
      await createProcurementRequest({
        notes: manualForm.notes,
        items: validItems.map((row) => ({
          inventory_item_id: Number(row.inventory_item_id),
          quantity: Number(row.quantity),
        })),
      }).unwrap();
      resetManualForm();
      setIsManualRequestModalOpen(false);
      refetchProcurementRequests();
      alert('Procurement request created');
    } catch (error) {
      alert(error?.data?.message || 'Failed to create procurement request');
    }
  };

  const handleCreateFromQueue = async () => {
    if (!selectedNeedIds.length) {
      alert('Select at least one need-to-procure record');
      return;
    }
    try {
      await createProcurementRequest({
        need_to_procure_ids: selectedNeedIds,
      }).unwrap();
      setSelectedNeedToProcure({});
      refetchProcurementRequests();
      refetchNeedQueue();
      alert('Queue items converted to procurement request');
    } catch (error) {
      alert(error?.data?.message || 'Failed to convert queue items');
    }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await updateProcurementRequestStatus({ id, status }).unwrap();
      refetchProcurementRequests();
      refetchApprovedQueue();
    } catch (error) {
      alert(error?.data?.message || 'Failed to update status');
    }
  };

  const handleCreateRfq = async () => {
    if (!rfqForm.procurement_request_id || !selectedSupplierIds.length) {
      alert('Select procurement request and suppliers');
      return;
    }
    try {
      await createRfq({
        procurement_request_id: Number(rfqForm.procurement_request_id),
        closing_date: rfqForm.closing_date || null,
        closing_time: rfqForm.closing_time || null,
        supplier_ids: selectedSupplierIds,
      }).unwrap();
      setSelectedSuppliers({});
      setRfqForm({ procurement_request_id: '', closing_date: '', closing_time: '' });
      refetchRfqs();
      refetchProcurementRequests();
      alert('RFQ created');
    } catch (error) {
      alert(error?.data?.message || 'Failed to create RFQ');
    }
  };

  const handleCreateQuotation = async () => {
    if (!selectedRfqId || !quotationForm.supplier_id) {
      alert('RFQ and supplier are required');
      return;
    }
    const subtotal = quotationForm.lineItems?.reduce(
      (sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0),
      0
    ) || 0;
    const taxRate = Number(quotationForm.tax_rate) || 0;
    const discount = Number(quotationForm.discount) || 0;
    const totalPrice = subtotal - discount + (subtotal - discount) * (taxRate / 100);
    if (!quotationForm.lineItems?.length) {
      alert('Select an RFQ with items first');
      return;
    }
    if (subtotal === 0) {
      alert('Enter unit price for at least one item');
      return;
    }
    try {
      const payload = {
        rfq_id: Number(selectedRfqId),
        supplier_id: Number(quotationForm.supplier_id),
        total_price: totalPrice,
        tax_rate: taxRate || null,
        discount: discount || null,
        delivery_time_days: quotationForm.delivery_time_days ? Number(quotationForm.delivery_time_days) : null,
      };
      if (quotationForm.quotation_id) {
        payload.quotation_id = Number(quotationForm.quotation_id);
      }
      if (quotationForm.lineItems?.length) {
        payload.items = quotationForm.lineItems.map((i) => ({
          procurement_request_item_id: i.procurement_request_item_id,
          inventory_item_id: i.inventory_item_id,
          quantity: i.quantity,
          unit_price: i.unit_price ? Number(i.unit_price) : null,
        }));
      }
      if (quotationForm.scanned_file) {
        payload.file = quotationForm.scanned_file;
      }
      await createSupplierQuotation(payload).unwrap();
      const wasUpdate = !!quotationForm.quotation_id;
      setQuotationForm({
        quotation_id: '',
        supplier_id: '',
        total_price: '',
        delivery_time_days: '',
        tax_rate: '',
        discount: '',
        scanned_file: null,
        existing_scanned_document: '',
        lineItems: [],
      });
      refetchQuotations();
      alert(wasUpdate ? 'Quotation updated' : 'Quotation saved');
    } catch (error) {
      alert(error?.data?.message || error?.message || 'Failed to save quotation');
    }
  };

  const handleSaveEvaluation = async () => {
    if (!selectedRfqId || !evaluationForm.quotation_id) {
      alert('Select quotation');
      return;
    }
    try {
      await saveQuotationEvaluation({
        rfq_id: Number(selectedRfqId),
        quotation_id: Number(evaluationForm.quotation_id),
        score: evaluationForm.score ? Number(evaluationForm.score) : null,
        comments: evaluationForm.comments,
      }).unwrap();
      await refetchQuotations();
      setEvaluationForm({ quotation_id: '', score: '', comments: '' });
      alert('Commercial evaluation saved');
    } catch (error) {
      alert(error?.data?.message || 'Failed to save evaluation');
    }
  };

  const handleSaveTechEvaluation = async () => {
    if (!selectedRfqId || !techForm.quotation_id) {
      alert('Select quotation');
      return;
    }
    try {
      await saveTechnicalEvaluation({
        rfq_id: Number(selectedRfqId),
        quotation_id: Number(techForm.quotation_id),
        status: techForm.status,
        comments: techForm.comments,
      }).unwrap();
      await refetchQuotations();
      setTechForm({ quotation_id: '', status: 'pending', comments: '' });
      alert('Technical evaluation saved');
    } catch (error) {
      alert(error?.data?.message || 'Failed to save technical evaluation');
    }
  };

  const handleFinalize = async () => {
    if (!selectedRfqId || !finalizeQuotationId) {
      alert('Select RFQ and quotation');
      return;
    }
    try {
      await finalizeQuotation({
        rfq_id: Number(selectedRfqId),
        quotation_id: Number(finalizeQuotationId),
      }).unwrap();
      refetchRfqs();
      refetchProcurementRequests();
      alert('Quotation finalized');
    } catch (error) {
      alert(error?.data?.message || 'Failed to finalize quotation');
    }
  };

  const handleCreatePo = async () => {
    if (!poForm.procurement_request_id || !poForm.supplier_id) {
      alert('Procurement request and supplier are required');
      return;
    }
    try {
      const payload = {
        procurement_request_id: Number(poForm.procurement_request_id),
        quotation_id: poForm.quotation_id ? Number(poForm.quotation_id) : null,
        supplier_id: Number(poForm.supplier_id),
      };
      if (poForm.lineItems?.length) {
        payload.items = poForm.lineItems.map((i) => ({
          inventory_item_id: i.inventory_item_id,
          quantity: i.quantity,
          unit_price: i.unit_price ? Number(i.unit_price) : null,
        }));
      }
      const createdPo = await createPurchaseOrder(payload).unwrap();
      setPoForm({
        procurement_request_id: '',
        quotation_id: '',
        supplier_id: '',
        lineItems: [],
      });
      await refetchPurchaseOrders();
      await refetchProcurementRequests();
      if (createdPo?.id) {
        handleDownloadPo(createdPo);
        setTimeout(() => alert('Purchase order created. Print dialog opened to save as PDF.'), 500);
      } else {
        alert('Purchase order created.');
      }
    } catch (error) {
      alert(error?.data?.message || 'Failed to create PO');
    }
  };

  const [fetchPoForDownload] = useLazyGetPurchaseOrderQuery();

  const handleDownloadPo = (po) => {
    if (!po?.items?.length) return;
    const poToPrint = po;
    const win = window.open('', '_blank');
    if (!win) {
      alert('Please allow popups to download the Purchase Order.');
      return;
    }
    const logoUrl = typeof window !== 'undefined' ? (window.location.origin + (COMPANY.logoPath || '')) : (COMPANY.logoPath || '');
    win.document.write(`
      <!DOCTYPE html><html><head><title>Purchase Order ${poToPrint.po_no}</title></head><body>
      <script>
        (function(){
        const po = ${JSON.stringify(poToPrint)};
        const COMPANY = ${JSON.stringify(COMPANY)};
        const logoUrl = ${JSON.stringify(logoUrl)};
        const items = po.items || [];
        const subtotal = items.reduce((s,i) => s + (Number(i.quantity)*Number(i.unit_price||0)), 0);
        const taxRate = Number(po.tax_rate)||0;
        const discount = Number(po.discount)||0;
        const tax = (subtotal-discount)*(taxRate/100);
        const total = subtotal - discount + tax;
        const poDate = po.created_at ? new Date(po.created_at).toLocaleDateString() : '';
        document.body.innerHTML = '<div style="font-family:Arial;max-width:800px;margin:0 auto;padding:24px">'+
          '<div style="display:flex;justify-content:space-between;margin-bottom:24px">'+
            '<div><img src="'+logoUrl+'" alt="" style="max-height:60px"/><div style="font-weight:bold">'+COMPANY.name+'</div><div>'+COMPANY.address+'</div><div>'+COMPANY.city+'</div><div>Postal: '+COMPANY.postalCode+'</div><div>'+COMPANY.email+'</div></div>'+
            '<h1 style="color:#e67e22;font-size:28px">Purchase Order</h1></div>'+
          '<div style="display:flex;justify-content:space-between;padding:12px;background:#fff5e6;margin-bottom:24px">'+
            '<div><strong>Bill To</strong><div>'+po.supplier_name+'</div>'+(po.address?'<div>'+po.address+'</div>':'')+(po.contact_person?'<div>'+po.contact_person+'</div>':'')+(po.email?'<div>'+po.email+'</div>':'')+(po.phone?'<div>'+po.phone+'</div>':'')+'</div>'+
            '<div><strong>PO #:</strong> '+po.po_no+'<br/><strong>Date:</strong> '+poDate+'<br/><strong>Procurement:</strong> '+po.procurement_no+'</div></div>'+
          '<table width="100%" style="border-collapse:collapse;margin-bottom:16px"><thead><tr style="background:#f0f0f0">'+
            '<th style="border:1px solid #ddd;padding:8px;text-align:left">Description</th><th style="border:1px solid #ddd;padding:8px;text-align:right">Quantity</th>'+
            '<th style="border:1px solid #ddd;padding:8px;text-align:right">Rate</th><th style="border:1px solid #ddd;padding:8px;text-align:right">Amount</th></tr></thead><tbody>'+
          items.map(i=>{ const q=Number(i.quantity)||0; const r=Number(i.unit_price)||0; return '<tr><td style="border:1px solid #ddd;padding:8px">'+(i.item_name||i.item_code||'-')+'</td><td style="border:1px solid #ddd;padding:8px;text-align:right">'+q+'</td><td style="border:1px solid #ddd;padding:8px;text-align:right">'+r.toFixed(2)+'</td><td style="border:1px solid #ddd;padding:8px;text-align:right">'+(q*r).toFixed(2)+'</td></tr>'; }).join('')+
          '</tbody></table>'+
          '<div style="padding:12px;background:#fff5e6;max-width:320px;margin-left:auto">'+
            '<div style="display:flex;justify-content:space-between">Subtotal: <span>'+subtotal.toFixed(2)+'</span></div>'+
            '<div style="display:flex;justify-content:space-between">Tax Rate (%): <span>'+taxRate.toFixed(2)+'</span></div>'+
            '<div style="display:flex;justify-content:space-between">Discount: <span>'+discount.toFixed(2)+'</span></div>'+
            '<div style="display:flex;justify-content:space-between">Tax: <span>'+tax.toFixed(2)+'</span></div>'+
            '<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:16px">Total: <span>'+total.toFixed(2)+'</span></div></div>'+
          (po.notes ? '<div style="margin-top:16px"><strong>Notes:</strong><div>'+po.notes+'</div></div>' : '')+
        '</div>';
        setTimeout(function(){ window.print(); }, 300);
        })();
      </script>
      </body></html>
    `);
    win.document.close();
  };

  const [fetchGrnForDownload] = useLazyGetGrnQuery();

  const handleCreateGrn = async () => {
    if (!selectedPoId || !selectedPurchaseOrder?.items?.length) {
      alert('Select PO first');
      return;
    }
    const { data: freshPo } = await refetchSelectedPo();
    const poItems = freshPo?.items || selectedPurchaseOrder.items;
    if (!poItems?.length) {
      alert('PO data not available');
      return;
    }
    const items = poItems
      .map((item) => {
        const receivedQty = Number(grnItemMap[item.id]?.received_qty) || 0;
        const rejectedQty = Number(grnItemMap[item.id]?.rejected_qty) || 0;
        const damagedQty = Number(grnItemMap[item.id]?.damaged_qty) || 0;
        const poQty = Number(item.quantity) || 0;
        const alreadyReceived = Number(item.received_qty) || 0;
        const pending = Math.max(0, poQty - alreadyReceived);
        return {
          po_item_id: item.id,
          received_qty: receivedQty,
          rejected_qty: rejectedQty,
          damaged_qty: damagedQty,
          remarks_condition_damage: grnItemMap[item.id]?.remarks_condition_damage || '',
          _pending: pending,
          _itemName: `${item.item_code || ''} ${item.item_name || ''}`.trim() || `Item ${item.id}`,
        };
      })
      .filter((x) => x.received_qty > 0);
    if (!items.length) {
      alert('Enter at least one received quantity');
      return;
    }
    const exceedsItem = items.find((x) => x.received_qty > x._pending);
    if (exceedsItem) {
      alert(`Received qty (${exceedsItem.received_qty}) exceeds pending qty (${exceedsItem._pending}) for ${exceedsItem._itemName}. Max receivable: ${exceedsItem._pending}.`);
      return;
    }
    const payloadItems = items.map(({ po_item_id, received_qty, rejected_qty, damaged_qty, remarks_condition_damage }) => ({
      po_item_id, received_qty, rejected_qty, damaged_qty, remarks_condition_damage,
    }));
    const payload = {
      po_id: Number(selectedPoId),
      items: payloadItems,
      received_at_location: grnForm.received_at_location || null,
      supplier_invoice_no: grnForm.supplier_invoice_no || null,
      supplier_invoice_date: grnForm.supplier_invoice_date || null,
      delivery_note_waybill_no: grnForm.delivery_note_waybill_no || null,
      vehicle_no_transport: grnForm.vehicle_no_transport || null,
      received_by_name: grnForm.received_by_name || null,
      received_by_designation: grnForm.received_by_designation || null,
      inspected_by_name: grnForm.inspected_by_name || null,
      inspection_condition: grnForm.inspection_condition || null,
      discrepancies_notes: grnForm.discrepancies_notes || null,
      shortage_excess_notes: grnForm.shortage_excess_notes || null,
      verified_by_name: grnForm.verified_by_name || null,
      approved_by_name: grnForm.approved_by_name || null,
    };
    try {
      await createGrn(payload).unwrap();
      setGrnItemMap({});
      setGrnForm({ received_at_location: '', supplier_invoice_no: '', supplier_invoice_date: '', delivery_note_waybill_no: '', vehicle_no_transport: '', received_by_name: '', received_by_designation: '', inspected_by_name: '', inspection_condition: 'good_condition', discrepancies_notes: '', shortage_excess_notes: '', verified_by_name: '', approved_by_name: '' });
      refetchGrns();
      refetchPurchaseOrders();
      alert('GRN posted');
    } catch (error) {
      alert(error?.data?.message || 'Failed to create GRN');
    }
  };

  const handleDownloadGrn = (grnId) => {
    fetchGrnForDownload(grnId).then((res) => {
      const grnData = res?.data;
      if (!grnData?.items?.length) {
        alert('GRN data not found');
        return;
      }
      const win = window.open('', '_blank');
      if (!win) {
        alert('Please allow popups to download the GRN.');
        return;
      }
      const grnLogoUrl = typeof window !== 'undefined' ? (window.location.origin + (COMPANY.logoPath || '')) : (COMPANY.logoPath || '');
      const content = `<div id="grn-root"></div>
        <script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
        <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
        <script>
          const grn = ${JSON.stringify(grnData)};
          const COMPANY = ${JSON.stringify(COMPANY)};
          const logoUrl = ${JSON.stringify(grnLogoUrl)};
          const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB', {day:'2-digit',month:'2-digit',year:'numeric'}) : '';
          const fmtDt = (d) => d ? new Date(d).toLocaleString('en-GB', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
          const items = grn.items || [];
          const grnDate = fmt(grn.received_date || grn.created_at);
          const poDate = fmt(grn.po_date);
          const receiptDt = fmtDt(grn.receipt_datetime || grn.created_at);
          const rows = items.map((it, i) => {
            const qo = Number(it.qty_ordered)||0, qr = Number(it.received_qty)||0, rej=Number(it.rejected_qty)||0, dam=Number(it.damaged_qty)||0;
            const qa = Math.max(0, qr - rej - dam), se = qr - qo, up = Number(it.unit_price)||0;
            return '<tr><td style="border:1px solid #ccc;padding:6;text-align:center">'+(i+1)+'</td><td style="border:1px solid #ccc;padding:6">'+(it.item_name||'-')+'</td><td style="border:1px solid #ccc;padding:6">'+(it.item_code||'-')+'</td><td style="border:1px solid #ccc;padding:6;text-align:center">'+(it.unit||'-')+'</td><td style="border:1px solid #ccc;padding:6;text-align:right">'+qo+'</td><td style="border:1px solid #ccc;padding:6;text-align:right">'+qr+'</td><td style="border:1px solid #ccc;padding:6;text-align:right">'+qa+'</td><td style="border:1px solid #ccc;padding:6;text-align:right">'+(se!==0?se:'-')+'</td><td style="border:1px solid #ccc;padding:6;text-align:right">'+up.toFixed(2)+'</td><td style="border:1px solid #ccc;padding:6">'+(it.remarks_condition_damage||'-')+'</td></tr>';
          }).join('');
          const totRc = items.reduce((s,i)=>s+(Number(i.received_qty)||0),0);
          const totAc = items.reduce((s,i)=>{const r=Number(i.received_qty)||0,rej=Number(i.rejected_qty)||0,dam=Number(i.damaged_qty)||0; return s+Math.max(0,r-rej-dam);},0);
          document.body.innerHTML = '<div style="font-family:Arial;max-width:800px;margin:0 auto;padding:24px">'+
            '<div><img src="'+logoUrl+'" style="max-height:50px"/><div><strong>'+COMPANY.name+'</strong></div><div>'+COMPANY.address+'</div><div>'+COMPANY.city+'</div>'+(COMPANY.postalCode?'<div>Postal: '+COMPANY.postalCode+'</div>':'')+'</div>'+
            '<h1 style="text-align:center;color:#1a5276;font-size:22px">GOODS RECEIVED NOTE</h1>'+
            '<div style="margin-bottom:16px"><strong>GRN No.:</strong> '+(grn.grn_no||'-')+' | <strong>Date:</strong> '+grnDate+' | <strong>Received at:</strong> '+(grn.received_at_location||'____')+'</div>'+
            '<div style="padding:12px;background:#f8f9fa;margin-bottom:16px"><strong>Supplier Details</strong><div>Supplier: '+(grn.supplier_name||'-')+' | Address: '+(grn.supplier_address||'-')+'</div><div>Invoice No: '+(grn.supplier_invoice_no||'-')+' | Invoice Date: '+fmt(grn.supplier_invoice_date)+' | PO No: '+(grn.po_no||'-')+' | PO Date: '+poDate+'</div><div>Delivery Note: '+(grn.delivery_note_waybill_no||'-')+' | Vehicle: '+(grn.vehicle_no_transport||'-')+'</div></div>'+
            '<div style="padding:12px;background:#f8f9fa;margin-bottom:16px"><strong>Delivery Details</strong><div>Received by: '+(grn.received_by_name||'-')+' ('+(grn.received_by_designation||'')+') | Date/Time: '+receiptDt+' | Inspected by: '+(grn.inspected_by_name||'-')+'</div></div>'+
            '<table width="100%" style="border-collapse:collapse;margin-bottom:16px;font-size:13px"><thead><tr style="background:#e8e8e8"><th style="border:1px solid #ccc;padding:6">S.No</th><th style="border:1px solid #ccc;padding:6">Item Desc</th><th style="border:1px solid #ccc;padding:6">Code</th><th style="border:1px solid #ccc;padding:6">Unit</th><th style="border:1px solid #ccc;padding:6">Qty Ord</th><th style="border:1px solid #ccc;padding:6">Qty Rcv</th><th style="border:1px solid #ccc;padding:6">Qty Acc</th><th style="border:1px solid #ccc;padding:6">Short/Ex</th><th style="border:1px solid #ccc;padding:6">Unit Price</th><th style="border:1px solid #ccc;padding:6">Remarks</th></tr></thead><tbody>'+rows+
            '<tr style="background:#f0f0f0;font-weight:bold"><td colspan="4" style="border:1px solid #ccc;padding:6">Total</td><td style="border:1px solid #ccc;padding:6"></td><td style="border:1px solid #ccc;padding:6;text-align:right">'+totRc+'</td><td style="border:1px solid #ccc;padding:6;text-align:right">'+totAc+'</td><td colspan="3" style="border:1px solid #ccc;padding:6"></td></tr></tbody></table>'+
            '<div style="padding:12px;background:#f8f9fa;margin-bottom:16px"><strong>Inspection:</strong> '+(grn.inspection_condition==='with_discrepancies'?'With discrepancies':'Good condition')+(grn.discrepancies_notes?' | '+grn.discrepancies_notes:'')+(grn.shortage_excess_notes?' | Shortage/Excess: '+grn.shortage_excess_notes:'')+'</div>'+
            '<div style="padding:12px;margin-bottom:16px"><strong>Received & Verified by:</strong> '+(grn.verified_by_name||'____')+' | <strong>Approved by:</strong> '+(grn.approved_by_name||'____')+'</div>'+
            '<div style="padding:12px;background:#fff5e6;font-size:12px"><strong>Accounts:</strong> GRN Entered: Yes | Posted to Inventory: '+(grn.status==='posted'?'Yes':'No')+(grn.accounts_remarks?' | Remarks: '+grn.accounts_remarks:'')+'</div></div>';
          setTimeout(function(){ window.print(); }, 300);
        <\/script>`;
      win.document.write('<!DOCTYPE html><html><head><title>GRN ' + (grnData.grn_no || '') + '</title></head><body>' + content + '</body></html>');
      win.document.close();
    });
  };

  return (
    <AdminStockPage>
      <AdminSubTabs
        tabs={TABS}
        active={activeTab}
        onChange={(key) => {
          const tab = TABS.find((t) => t.key === key) || TABS[0];
          setActiveTab(tab.key);
          navigate({ pathname: tab.path, search: routerLocation.search });
        }}
      />
      <div className="procurement-process-page admin-stock-body">

      {activeTab === 'requests' && (
        <div className="procurement-process-step procurement-process-section-grid">
          <div>
            <div className="procurement-process-heading-row">
              <h4>Convert Need-To-Procure to Procurement Request</h4>
              <div className="procurement-process-heading-actions">
                <button
                  type="button"
                  className="admin-stock-btn admin-stock-btn--primary procurement-process-manual-btn"
                  onClick={() => setIsManualRequestModalOpen(true)}
                >
                  Manual Request
                </button>
                <button
                  type="button"
                  className="procurement-process-queue-btn admin-stock-btn"
                  onClick={handleCreateFromQueue}
                >
                  Create Procurement
                </button>
              </div>
            </div>
            <table width="100%" cellPadding="6">
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Request</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {needToProcureQueue.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={Boolean(selectedNeedToProcure[row.id])}
                        onChange={(e) => setSelectedNeedToProcure((prev) => ({ ...prev, [row.id]: e.target.checked }))}
                      />
                    </td>
                    <td>{row.request_no}</td>
                    <td>{row.item_name}</td>
                    <td>{row.quantity}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
                {!needToProcureQueue.length && (
                  <tr>
                    <td colSpan={5}>No items available to convert. Items already converted will not appear here.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'requests' && isManualRequestModalOpen && (
        <div
          className="procurement-process-modal-overlay"
          onClick={() => { setIsManualRequestModalOpen(false); resetManualForm(); }}
        >
          <div
            className="procurement-process-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="procurement-process-modal-header">
              <h4 className="procurement-process-modal-title">Manual Procurement Request</h4>
              <button
                type="button"
                className="procurement-process-modal-close-btn"
                onClick={() => { setIsManualRequestModalOpen(false); resetManualForm(); }}
                aria-label="Close manual procurement request popup"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateManualProcurement} className="procurement-process-form">
              <div className="procurement-process-manual-items">
                <div className="procurement-process-manual-items-header">
                  <span>Item</span>
                  <span>Quantity</span>
                  <span className="procurement-process-manual-items-actions">Action</span>
                </div>
                {manualForm.lineItems.map((row, index) => (
                  <div key={index} className="procurement-process-manual-item-row">
                    <select
                      value={row.inventory_item_id}
                      onChange={(e) => updateManualFormRow(index, 'inventory_item_id', e.target.value)}
                    >
                      <option value="">Select Item</option>
                      {inventoryItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.item_code} - {item.item_name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={row.quantity}
                      onChange={(e) => updateManualFormRow(index, 'quantity', e.target.value)}
                      placeholder="Qty"
                    />
                    <button
                      type="button"
                      className="procurement-process-remove-row-btn"
                      onClick={() => removeManualFormRow(index)}
                      aria-label="Remove row"
                      title="Remove row"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="procurement-process-add-row-btn"
                  onClick={addManualFormRow}
                >
                  + Add Item
                </button>
              </div>
              <textarea
                rows={2}
                value={manualForm.notes}
                onChange={(e) => setManualForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Notes (optional)"
              />
              <div className="procurement-process-modal-actions">
                <button
                  type="button"
                  className="procurement-process-modal-cancel-btn"
                  onClick={() => { setIsManualRequestModalOpen(false); resetManualForm(); }}
                >
                  Cancel
                </button>
                <button type="submit" disabled={creatingProcRequest}>
                  {creatingProcRequest ? 'Creating...' : 'Create Manual Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'approval' && (
        <div className="procurement-process-step procurement-process-section-grid">
          <div>
            <h4>Pending</h4>
            <table width="100%" cellPadding="6">
              <thead>
                <tr>
                  <th>Procurement No</th>
                  <th>Status</th>
                  <th>Items</th>
                  <th>Total Qty</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingProcurementRequests.map((row) => (
                  <tr key={row.id}>
                    <td>{row.procurement_no}</td>
                    <td>{row.status}</td>
                    <td>{row.item_count}</td>
                    <td>{row.total_qty}</td>
                    <td>
                      <div className="procurement-process-actions-cell">
                        <button type="button" className="link-button" onClick={() => handleViewApprovalRequestItems(row.id)}>
                          View items
                        </button>
                        <button type="button" onClick={() => handleStatusUpdate(row.id, 'approved')}>Approve</button>
                        <button type="button" onClick={() => handleStatusUpdate(row.id, 'rejected')}>Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!pendingProcurementRequests.length && (
                  <tr>
                    <td colSpan={5}>No pending procurement requests</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div>
            <h4>History</h4>
            <table width="100%" cellPadding="6">
              <thead>
                <tr>
                  <th>Procurement No</th>
                  <th>Status</th>
                  <th>Items</th>
                  <th>Total Qty</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {approvalHistory.map((row) => (
                  <tr key={row.id}>
                    <td>{row.procurement_no}</td>
                    <td>{row.status}</td>
                    <td>{row.item_count}</td>
                    <td>{row.total_qty}</td>
                    <td>
                      <button type="button" className="link-button" onClick={() => handleViewApprovalRequestItems(row.id)}>
                        View items
                      </button>
                    </td>
                  </tr>
                ))}
                {!approvalHistory.length && (
                  <tr>
                    <td colSpan={5}>No approval history</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'approval' && approvalItemsPopupRequestId != null && (
        <div
          className="procurement-process-modal-overlay"
          onClick={() => setApprovalItemsPopupRequestId(null)}
        >
          <div
            className="procurement-process-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '560px' }}
          >
            <div className="procurement-process-modal-header">
              <h4 className="procurement-process-modal-title">Procurement request items</h4>
              <button
                type="button"
                className="procurement-process-modal-close-btn"
                onClick={() => setApprovalItemsPopupRequestId(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="procurement-process-step">
              {loadingRequestDetails && !approvalRequestDetailsCache[approvalItemsPopupRequestId] ? (
                <div style={{ textAlign: 'center' }}>Loading items...</div>
              ) : approvalRequestDetailsCache[approvalItemsPopupRequestId]?.items?.length > 0 ? (
                <>
                  <div className="procurement-process-step-desc">
                    <strong>Procurement No:</strong> {approvalRequestDetailsCache[approvalItemsPopupRequestId]?.procurement_no ?? approvalItemsPopupRequestId}
                  </div>
                  <table width="100%" cellPadding="6">
                    <thead>
                      <tr>
                        <th>Item Code</th>
                        <th>Item Name</th>
                        <th>Unit</th>
                        <th style={{ textAlign: 'right' }}>Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvalRequestDetailsCache[approvalItemsPopupRequestId].items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.item_code || '-'}</td>
                          <td>{item.item_name || '-'}</td>
                          <td>{item.unit ?? item.unit_name ?? item.units ?? '-'}</td>
                          <td style={{ textAlign: 'right' }}>{Number(item.quantity) || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <div style={{ textAlign: 'center' }}>No line items</div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'rfq' && (
        <div className="procurement-process-step procurement-process-stack-md procurement-process-rfq-form">
          <h4>Request Quotations</h4>
          <div className="procurement-process-form-group">
            <select
              value={rfqForm.procurement_request_id}
              onChange={(e) => setRfqForm((prev) => ({ ...prev, procurement_request_id: e.target.value }))}
            >
              <option value="">Select Approved Procurement</option>
              {approvedQueue.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.procurement_no}
                </option>
              ))}
            </select>
          </div>
          <div className="procurement-process-form-group procurement-process-row-two procurement-process-labeled-row">
            <div className="procurement-process-field-with-label">
              <label>Closing Date</label>
              <input
                type="date"
                value={rfqForm.closing_date}
                onChange={(e) => setRfqForm((prev) => ({ ...prev, closing_date: e.target.value }))}
              />
            </div>
            <div className="procurement-process-field-with-label">
              <label>Closing Time</label>
              <input
                type="time"
                value={rfqForm.closing_time}
                onChange={(e) => setRfqForm((prev) => ({ ...prev, closing_time: e.target.value }))}
              />
            </div>
          </div>
          {rfqSelectedProcurement?.items?.length > 0 && (
            <div className="procurement-process-form-group procurement-process-panel procurement-process-panel-rounded">
              <strong>Procurement items</strong>
              <p className="procurement-process-step-desc">
                {rfqSelectedProcurement.procurement_no ?? 'Selected procurement'} – items to request quotations for
              </p>
              <table width="100%" cellPadding="6">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Code</th>
                    <th>Unit</th>
                    <th style={{ textAlign: 'right' }}>Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {rfqSelectedProcurement.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.item_name || '—'}</td>
                      <td>{item.item_code || '—'}</td>
                      <td>{item.unit ?? '—'}</td>
                      <td style={{ textAlign: 'right' }}>{Number(item.quantity) || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="procurement-process-form-group procurement-process-supplier-select-panel">
            <div className="procurement-process-supplier-select-header">
              <div>
                <h4 className="procurement-process-supplier-select-title">Select Suppliers</h4>
                <p className="procurement-process-supplier-select-hint">Select one or more suppliers to request quotations from</p>
              </div>
              <div className="procurement-process-supplier-select-actions">
                <button
                  type="button"
                  className="procurement-process-supplier-select-btn"
                  onClick={() => {
                    const next = {};
                    supplierList.forEach((sup) => { next[String(sup.id)] = true; });
                    setSelectedSuppliers(next);
                  }}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="procurement-process-supplier-select-btn"
                  onClick={() => setSelectedSuppliers({})}
                >
                  Clear all
                </button>
                <span className="procurement-process-supplier-select-count">
                  {selectedSupplierOptionValues.length} supplier{selectedSupplierOptionValues.length !== 1 ? 's' : ''} selected
                </span>
              </div>
            </div>
            <div className="procurement-process-supplier-list-wrap">
              {supplierList.length === 0 ? (
                <div className="procurement-process-supplier-list-empty">No suppliers found</div>
              ) : (
                <div className="procurement-process-supplier-grid">
                  {supplierList.map((sup) => {
                    const idStr = String(sup.id);
                    const checked = Boolean(selectedSuppliers[idStr]);
                    return (
                      <div
                        key={sup.id}
                        role="button"
                        tabIndex={0}
                        className={`procurement-process-supplier-card ${checked ? 'is-selected' : ''}`}
                        onClick={() => {
                          setSelectedSuppliers((prev) => ({ ...prev, [idStr]: !prev[idStr] }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedSuppliers((prev) => ({ ...prev, [idStr]: !prev[idStr] }));
                          }
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSelectedSuppliers((prev) => ({ ...prev, [idStr]: !prev[idStr] }));
                          }}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ${sup.supplier_name}`}
                        />
                        <div className="procurement-process-supplier-card-body">
                          <span className="procurement-process-supplier-card-name">{sup.supplier_name}</span>
                          {sup.supplier_code && (
                            <span className="procurement-process-supplier-card-code">{sup.supplier_code}</span>
                          )}
                        </div>
                        {checked && <span className="procurement-process-supplier-item-check" aria-hidden>✓</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <button type="button" disabled={creatingRfq} onClick={handleCreateRfq}>
            {creatingRfq ? 'Creating RFQ...' : 'Create RFQ'}
          </button>
        </div>
      )}

      {activeTab === 'submit-quotation' && (
        <div className="procurement-process-step procurement-process-stack-md procurement-process-rfq-form">
          <div className="procurement-process-heading-row">
            <h4>Submit Supplier Quotation</h4>
            <button
              type="button"
              className="procurement-process-queue-btn"
              onClick={() => setIsPendingQuotationsPopupOpen(true)}
            >
              View Pending Quotations
            </button>
          </div>
          <div className="procurement-process-form-group">
            <label>Select RFQ</label>
            <div className="procurement-process-rfq-select-row">
              <select
                value={selectedRfqId}
                onChange={(e) => {
                  setSelectedRfqId(e.target.value);
                  if (activeTab === 'submit-quotation') {
                    setQuotationForm((prev) => ({
                      ...prev,
                      quotation_id: '',
                      supplier_id: '',
                      lineItems: [],
                      total_price: '',
                      tax_rate: '',
                      discount: '',
                      existing_scanned_document: '',
                    }));
                  }
                }}
              >
                <option value="">Select RFQ</option>
                {rfqs.map((rfq) => (
                  <option key={rfq.id} value={rfq.id}>{rfq.rfq_no}</option>
                ))}
              </select>
              <button
                type="button"
                className="procurement-process-queue-btn"
                onClick={() => setIsProcurementItemsPopupOpen(true)}
                disabled={!selectedRfqId}
                title="View procurement items for this RFQ"
              >
                View Items
              </button>
            </div>
          </div>
          <div className="procurement-process-form-group">
            <label>Select Supplier</label>
            <select
              value={quotationForm.supplier_id}
              onChange={async (e) => {
                const supplierId = e.target.value;
                const clearedForm = {
                  quotation_id: '',
                  supplier_id: supplierId,
                  total_price: '',
                  delivery_time_days: '',
                  tax_rate: '',
                  discount: '',
                  scanned_file: null,
                  existing_scanned_document: '',
                  lineItems: [],
                };
                setQuotationForm(clearedForm);
                if (supplierId && quotationBySupplierId.has(supplierId)) {
                  const quot = quotationBySupplierId.get(supplierId);
                  const res = await fetchQuotationById(quot.id);
                  const q = res?.data;
                  if (q?.items?.length) {
                    setQuotationForm({
                      ...clearedForm,
                      quotation_id: String(q.id),
                      lineItems: q.items.map((it) => ({
                        procurement_request_item_id: it.procurement_request_item_id,
                        inventory_item_id: it.inventory_item_id,
                        item_code: it.item_code,
                        item_name: it.item_name,
                        quantity: it.quantity,
                        unit_price: it.unit_price != null ? String(it.unit_price) : '',
                      })),
                      tax_rate: q.tax_rate != null ? String(q.tax_rate) : '',
                      discount: q.discount != null ? String(q.discount) : '',
                      delivery_time_days: q.delivery_time_days ? String(q.delivery_time_days) : '',
                      existing_scanned_document: q.scanned_document || '',
                    });
                  }
                }
              }}
            >
              <option value="">Select Supplier</option>
              {supplierList.map((s) => {
                const hasSubmitted = supplierIdsWithQuotation.includes(String(s.id));
                return (
                  <option key={s.id} value={s.id}>
                    {s.supplier_name}{hasSubmitted ? ' (Submitted)' : ''}
                  </option>
                );
              })}
            </select>
            {quotationForm.quotation_id && (
              <span className="procurement-process-file-hint">
                Editing existing quotation. Submit to update.
              </span>
            )}
          </div>
          {quotationForm.lineItems?.length > 0 && (
            <div className="procurement-process-panel">
              <strong>Enter unit price for each item</strong>
              <table width="100%" cellPadding="6">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {quotationForm.lineItems.map((item, idx) => {
                    const qty = Number(item.quantity) || 0;
                    const up = item.unit_price ? Number(item.unit_price) : 0;
                    const amount = qty * up;
                    return (
                      <tr key={item.inventory_item_id || item.procurement_request_item_id || idx}>
                        <td>{item.item_name || item.item_code}</td>
                        <td>{qty}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => {
                              const v = e.target.value;
                              setQuotationForm((prev) => ({
                                ...prev,
                                lineItems: prev.lineItems.map((it, i) =>
                                  i === idx ? { ...it, unit_price: v } : it
                                ),
                              }));
                            }}
                            style={{ width: 100 }}
                            placeholder="0.00"
                          />
                        </td>
                        <td>{amount.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="procurement-process-form-group procurement-process-row-two">
            <label>Tax rate (%)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={quotationForm.tax_rate}
              onChange={(e) => setQuotationForm((prev) => ({ ...prev, tax_rate: e.target.value }))}
              style={{ width: 80 }}
            />
            <label>Discount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={quotationForm.discount}
              onChange={(e) => setQuotationForm((prev) => ({ ...prev, discount: e.target.value }))}
              style={{ width: 80 }}
            />
          </div>
          {quotationForm.lineItems?.length > 0 && (() => {
            const sub = quotationForm.lineItems.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);
            const tr = Number(quotationForm.tax_rate) || 0;
            const d = Number(quotationForm.discount) || 0;
            const calcTotal = sub - d + (sub - d) * (tr / 100);
            return (
              <div className="procurement-process-form-group">
                <label>Total Price (calculated automatically)</label>
                <div style={{ padding: '6px 8px', background: '#f5f5f5', fontWeight: 600, fontSize: '1rem' }}>
                  {calcTotal.toFixed(2)}
                </div>
              </div>
            );
          })()}
          <div className="procurement-process-form-group procurement-process-row-two">
            <label>Delivery Days</label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Delivery Days"
              value={quotationForm.delivery_time_days}
              onChange={(e) => setQuotationForm((prev) => ({ ...prev, delivery_time_days: e.target.value }))}
            />
          </div>
          <div className="procurement-process-form-group">
            <label htmlFor="quotation-scanned-doc">Scanned Quotation (PDF or Image)</label>
            <input
              id="quotation-scanned-doc"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => setQuotationForm((prev) => ({ ...prev, scanned_file: e.target.files?.[0] || null }))}
            />
            {quotationForm.scanned_file && (
              <span className="procurement-process-file-hint">{quotationForm.scanned_file.name}</span>
            )}
            {quotationForm.existing_scanned_document && !quotationForm.scanned_file && (
              <div>
                <span className="procurement-process-file-hint">Current document: </span>
                <a
                  href={getResourceUrl('QUOTATION_DOCUMENT', quotationForm.existing_scanned_document)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginLeft: 4 }}
                >
                  View document
                </a>
              </div>
            )}
          </div>
          <button type="button" disabled={creatingQuotation} onClick={handleCreateQuotation}>
            {creatingQuotation ? 'Saving Quotation...' : 'Save Quotation'}
          </button>
        </div>
      )}

      {isPendingQuotationsPopupOpen && (
        <div
          className="procurement-process-modal-overlay"
          onClick={() => setIsPendingQuotationsPopupOpen(false)}
        >
          <div className="procurement-process-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="procurement-process-modal-header">
              <h4 className="procurement-process-modal-title">Pending Quotations Queue</h4>
              <button
                type="button"
                className="procurement-process-modal-close-btn"
                onClick={() => setIsPendingQuotationsPopupOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div>
              <table width="100%" cellPadding="6">
                <thead>
                  <tr>
                    <th>RFQ</th>
                    <th>Procurement</th>
                    <th>Closing</th>
                    <th>Requested</th>
                    <th>Received</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingQueue.map((row) => (
                    <tr key={row.id}>
                      <td>{row.rfq_no}</td>
                      <td>{row.procurement_no}</td>
                      <td>{formatDateDisplay(row.closing_date)}{row.closing_time ? ` ${String(row.closing_time).slice(0, 5)}` : ''}</td>
                      <td>{row.suppliers_requested}</td>
                      <td>{row.quotations_received}</td>
                      <td>{row.status}</td>
                    </tr>
                  ))}
                  {!pendingQueue.length && (
                    <tr>
                      <td colSpan={6}>No pending quotations</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {isProcurementItemsPopupOpen && (
        <div
          className="procurement-process-modal-overlay"
          onClick={() => setIsProcurementItemsPopupOpen(false)}
        >
          <div className="procurement-process-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="procurement-process-modal-header">
              <h4 className="procurement-process-modal-title">
                Procurement Items {selectedRfqProcurementRequest?.procurement_no ? `- ${selectedRfqProcurementRequest.procurement_no}` : ''}
              </h4>
              <button
                type="button"
                className="procurement-process-modal-close-btn"
                onClick={() => setIsProcurementItemsPopupOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div>
              {selectedRfqProcurementRequest?.items?.length > 0 ? (
                <table width="100%" cellPadding="6">
                  <thead>
                    <tr>
                      <th>Item Code</th>
                      <th>Item Name</th>
                      <th>Quantity</th>
                      <th>Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRfqProcurementRequest.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.item_code}</td>
                        <td>{item.item_name}</td>
                        <td>{item.quantity}</td>
                        <td>{item.unit || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No procurement items found. Select an RFQ first.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {(activeTab === 'eval' || activeTab === 'tech' || activeTab === 'finalize') && (
        <div className="procurement-process-step procurement-process-stack-md">
          <select value={selectedRfqId} onChange={(e) => setSelectedRfqId(e.target.value)}>
            <option value="">Select RFQ</option>
            {rfqs.map((rfq) => (
              <option key={rfq.id} value={rfq.id}>{rfq.rfq_no} ({rfq.status})</option>
            ))}
          </select>
          <table width="100%" cellPadding="6">
            <thead>
              <tr>
                <th>ID</th>
                <th>Supplier</th>
                <th>Quotation No</th>
                <th>Total Price</th>
                {(activeTab === 'eval' || activeTab === 'finalize') && <th>Score</th>}
                {(activeTab === 'eval' || activeTab === 'finalize') && <th>Commercial Evaluation</th>}
                {(activeTab === 'tech' || activeTab === 'finalize') && <th>Tech Evaluation</th>}
                <th>Quotation Document</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {quotations.map((q) => {
                const docUrl = q.scanned_document
                  ? getResourceUrl('QUOTATION_DOCUMENT', q.scanned_document)
                  : null;
                const isImage = q.scanned_document && /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(q.scanned_document);
                return (
                <tr key={q.id}>
                  <td>{q.id}</td>
                  <td>{q.supplier_name}</td>
                  <td>{q.quotation_no}</td>
                  <td>{q.total_price}</td>
                  {(activeTab === 'eval' || activeTab === 'finalize') && (
                    <td>{q.commercial_score != null ? q.commercial_score : '-'}</td>
                  )}
                  {(activeTab === 'eval' || activeTab === 'finalize') && (
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={q.commercial_comments || ''}>
                      {q.commercial_comments ? String(q.commercial_comments).slice(0, 80) + (q.commercial_comments.length > 80 ? '...' : '') : '-'}
                    </td>
                  )}
                  {(activeTab === 'tech' || activeTab === 'finalize') && (
                    <td style={{ maxWidth: '220px' }} title={q.tech_comments || ''}>
                      {q.tech_status || '-'}
                      {q.tech_comments && (
                        <span className="procurement-process-step-desc" style={{ display: 'block' }}>
                          {String(q.tech_comments).slice(0, 60)}{q.tech_comments.length > 60 ? '...' : ''}
                        </span>
                      )}
                    </td>
                  )}
                  <td>
                    {docUrl ? (
                      isImage ? (
                        <a href={docUrl} target="_blank" rel="noopener noreferrer" title="View document">
                          <img src={docUrl} alt="Quotation" style={{ maxWidth: 60, maxHeight: 50, objectFit: 'contain' }} />
                        </a>
                      ) : (
                        <a href={docUrl} target="_blank" rel="noopener noreferrer">View PDF</a>
                      )
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>{q.status === 'selected' ? 'Finalized' : q.status}</td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'eval' && (
        <div className="procurement-process-stack-sm procurement-process-step procurement-process-mt">
          <h4>Commercial Evaluation</h4>
          <select
            value={evaluationForm.quotation_id}
            onChange={(e) => setEvaluationForm((prev) => ({ ...prev, quotation_id: e.target.value }))}
          >
            <option value="">Select Quotation</option>
            {quotations.map((q) => <option key={q.id} value={q.id}>{q.quotation_no} - {q.supplier_name}</option>)}
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Score"
            value={evaluationForm.score}
            onChange={(e) => setEvaluationForm((prev) => ({ ...prev, score: e.target.value }))}
          />
          <textarea
            rows={2}
            placeholder="Comments"
            value={evaluationForm.comments}
            onChange={(e) => setEvaluationForm((prev) => ({ ...prev, comments: e.target.value }))}
          />
          <button type="button" onClick={handleSaveEvaluation}>Save Evaluation</button>
        </div>
      )}

      {activeTab === 'tech' && (
        <div className="procurement-process-stack-sm procurement-process-step procurement-process-mt">
          <h4>Technical Evaluation</h4>
          <select
            value={techForm.quotation_id}
            onChange={(e) => setTechForm((prev) => ({ ...prev, quotation_id: e.target.value }))}
          >
            <option value="">Select Quotation</option>
            {quotations.map((q) => <option key={q.id} value={q.id}>{q.quotation_no} - {q.supplier_name}</option>)}
          </select>
          <select value={techForm.status} onChange={(e) => setTechForm((prev) => ({ ...prev, status: e.target.value }))}>
            <option value="pending">Pending</option>
            <option value="pass">Pass</option>
            <option value="fail">Fail</option>
          </select>
          <textarea
            rows={2}
            placeholder="Comments"
            value={techForm.comments}
            onChange={(e) => setTechForm((prev) => ({ ...prev, comments: e.target.value }))}
          />
          <button type="button" onClick={handleSaveTechEvaluation}>Save Tech Evaluation</button>
        </div>
      )}

      {activeTab === 'finalize' && (
        <div className="procurement-process-stack-sm procurement-process-step procurement-process-mt">
          <h4>Finalize Quotations</h4>
          {selectedRfq?.status === 'finalized' ? (
            <div className="procurement-process-step-desc">
              This RFQ has been finalized.
              {(() => {
                const winning = quotations.find((q) => q.status === 'selected');
                return winning?.supplier_name ? (
                  <span> Winning supplier: <strong>{winning.supplier_name}</strong></span>
                ) : null;
              })()}
              {selectedRfq.finalized_by_name && (
                <span> Finalized by: <strong>{selectedRfq.finalized_by_name}</strong></span>
              )}
              {selectedRfq.finalized_at && (
                <span> on {new Date(selectedRfq.finalized_at).toLocaleString()}</span>
              )}
            </div>
          ) : (
            <>
              <select value={finalizeQuotationId} onChange={(e) => setFinalizeQuotationId(e.target.value)}>
                <option value="">Select Winning Quotation</option>
                {quotations.map((q) => <option key={q.id} value={q.id}>{q.quotation_no} - {q.supplier_name}</option>)}
              </select>
              <button type="button" onClick={handleFinalize}>Finalize Selected Quotation</button>
            </>
          )}
        </div>
      )}

      {activeTab === 'po' && (
        <div className="procurement-process-step procurement-process-stack-md">
          <h4>Purchasing Order Issue</h4>
          <p className="procurement-process-step-desc">Select a finalized procurement to create a purchase order from the finalized quotation.</p>
          <select
            value={poForm.procurement_request_id}
            onChange={(e) => setPoForm((prev) => ({
              ...prev,
              procurement_request_id: e.target.value,
              quotation_id: '',
              supplier_id: '',
              tax_rate: '',
              discount: '',
              notes: '',
              lineItems: [],
            }))}
          >
            <option value="">Select Finalized Procurement</option>
            {finalizedProcurementsForPo.map((row) => (
              <option key={row.id} value={row.id}>
                {row.procurement_no}
              </option>
            ))}
          </select>
          {selectedProcurementRequest?.items?.length > 0 && (
            <div className="procurement-process-panel">
              <strong>Procurement Items</strong>
              {selectedProcurementRequest.items.map((item) => (
                <div key={item.id}>{item.item_code} - {item.item_name} / Qty: {item.quantity}</div>
              ))}
            </div>
          )}
          {finalizedQuotationForPo ? (
            <div className="procurement-process-panel">
              <strong>Finalized Quotation (Selected Supplier)</strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <strong>Supplier:</strong> {finalizedQuotationForPo.supplier_name}
                </div>
                <div>
                  <strong>Quotation No:</strong> {finalizedQuotationForPo.quotation_no}
                </div>
                <div>
                  <strong>Total Price:</strong> {finalizedQuotationForPo.total_price}
                </div>
                {finalizedQuotationForPo.scanned_document && (
                  <div>
                    <strong>Document:</strong>{' '}
                    {/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(finalizedQuotationForPo.scanned_document) ? (
                      <a
                        href={getResourceUrl('QUOTATION_DOCUMENT', finalizedQuotationForPo.scanned_document)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View quotation"
                      >
                        <img
                          src={getResourceUrl('QUOTATION_DOCUMENT', finalizedQuotationForPo.scanned_document)}
                          alt="Quotation"
                          style={{ maxWidth: 80, maxHeight: 60, objectFit: 'contain', verticalAlign: 'middle' }}
                        />
                      </a>
                    ) : (
                      <a
                        href={getResourceUrl('QUOTATION_DOCUMENT', finalizedQuotationForPo.scanned_document)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View PDF
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : poForm.procurement_request_id && rfqIdForQuotations ? (
            <div className="procurement-process-step-desc">No finalized quotation found for this procurement.</div>
          ) : null}
          {poForm.lineItems?.length > 0 && (
            <div className="procurement-process-panel">
              <strong>Line items – enter unit price per item</strong>
              <table width="100%" cellPadding="6">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {poForm.lineItems.map((item, idx) => {
                    const qty = Number(item.quantity) || 0;
                    const up = item.unit_price ? Number(item.unit_price) : 0;
                    const amount = qty * up;
                    return (
                      <tr key={item.inventory_item_id || idx}>
                        <td>{item.item_name || item.item_code}</td>
                        <td>{qty}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => {
                              const v = e.target.value;
                              setPoForm((prev) => ({
                                ...prev,
                                lineItems: prev.lineItems.map((it, i) =>
                                  i === idx ? { ...it, unit_price: v } : it
                                ),
                              }));
                            }}
                            style={{ width: 100 }}
                            placeholder="0.00"
                          />
                        </td>
                        <td>{amount.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {selectedProcurementFullyReceived && (
            <p className="procurement-process-step-desc">
              This procurement has been fully received. No need to issue another purchase order.
            </p>
          )}
          <button
            type="button"
            disabled={creatingPo || !finalizedQuotationForPo || !poForm.procurement_request_id || selectedProcurementFullyReceived}
            onClick={handleCreatePo}
          >
            {creatingPo ? 'Creating PO...' : 'Issue Purchase Order'}
          </button>

          <table width="100%" cellPadding="6">
            <thead>
              <tr>
                <th>PO No</th>
                <th>Procurement No</th>
                <th>Supplier</th>
                <th>Status</th>
                <th>Items</th>
                <th>Received Qty</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.map((po) => (
                <tr key={po.id}>
                  <td>{po.po_no}</td>
                  <td>{po.procurement_no}</td>
                  <td>{po.supplier_name}</td>
                  <td>{po.status}</td>
                  <td>{po.item_count}</td>
                  <td>{po.total_received_qty || 0}</td>
                  <td>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => {
                        fetchPoForDownload(po.id).then((res) => {
                          if (res.data) handleDownloadPo(res.data);
                        });
                      }}
                    >
                      Download PO
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'grn' && (
        <div className="procurement-process-step procurement-process-stack-md">
          <h4>Goods Received Note</h4>
          <select value={selectedPoId} onChange={(e) => setSelectedPoId(e.target.value)}>
            <option value="">Select Purchase Order</option>
            {purchaseOrders.map((po) => (
              <option key={po.id} value={po.id}>{po.po_no} ({po.status})</option>
            ))}
          </select>
          {selectedPurchaseOrder?.items?.length > 0 && (
            <>
            <div className="procurement-process-panel procurement-process-panel-rounded">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Purchase Order Details</strong>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => handleDownloadPo(selectedPurchaseOrder)}
                >
                  View / Download PO
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <strong>PO #:</strong> {selectedPurchaseOrder.po_no} &nbsp;|&nbsp;
                  <strong>Procurement:</strong> {selectedPurchaseOrder.procurement_no || '-'}
                </div>
                <div>
                  <strong>Date:</strong> {selectedPurchaseOrder.created_at ? formatDateDisplay(selectedPurchaseOrder.created_at) : '-'}
                </div>
              </div>
              <div>
                <strong>Supplier:</strong> {selectedPurchaseOrder.supplier_name || '-'}
                {selectedPurchaseOrder.contact_person && ` | ${selectedPurchaseOrder.contact_person}`}
                {selectedPurchaseOrder.email && ` | ${selectedPurchaseOrder.email}`}
              </div>
              <table width="100%" cellPadding="6">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style={{ textAlign: 'right' }}>Quantity</th>
                    <th style={{ textAlign: 'right' }}>Received</th>
                    <th style={{ textAlign: 'right' }}>Pending</th>
                    <th style={{ textAlign: 'right' }}>Rate</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPurchaseOrder.items.map((item) => {
                    const qty = Number(item.quantity) || 0;
                    const received = Number(item.received_qty) || 0;
                    const pending = Math.max(0, qty - received);
                    const rate = Number(item.unit_price) || 0;
                    const amount = qty * rate;
                    return (
                      <tr key={item.id}>
                        <td>{item.item_code} - {item.item_name}</td>
                        <td style={{ textAlign: 'right' }}>{qty}</td>
                        <td style={{ textAlign: 'right' }}>{received}</td>
                        <td style={{ textAlign: 'right' }}><strong>{pending}</strong></td>
                        <td style={{ textAlign: 'right' }}>{rate.toFixed(2)}</td>
                        <td style={{ textAlign: 'right' }}>{amount.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {selectedPurchaseOrder.tax_rate != null && (
                <div style={{ textAlign: 'right', fontSize: '0.875rem' }}>
                  Tax: {Number(selectedPurchaseOrder.tax_rate) || 0}%
                  {selectedPurchaseOrder.discount != null && Number(selectedPurchaseOrder.discount) > 0 && (
                    <> | Discount: {Number(selectedPurchaseOrder.discount).toFixed(2)}</>
                  )}
                </div>
              )}
            </div>
            <div className="procurement-process-panel procurement-process-panel-rounded">
              <div className="procurement-process-grn-extended">
                <strong>Delivery & Inspection Details (optional)</strong>
                <div className="procurement-process-row-two">
                  <div className="procurement-process-field-with-label">
                    <label>Received at (Warehouse)</label>
                    <input
                      value={grnForm.received_at_location}
                      onChange={(e) => setGrnForm((p) => ({ ...p, received_at_location: e.target.value }))}
                      placeholder="Warehouse / Location"
                    />
                  </div>
                  <div className="procurement-process-field-with-label">
                    <label>Supplier Invoice No.</label>
                    <input
                      value={grnForm.supplier_invoice_no}
                      onChange={(e) => setGrnForm((p) => ({ ...p, supplier_invoice_no: e.target.value }))}
                      placeholder="Invoice No."
                    />
                  </div>
                </div>
                <div className="procurement-process-row-two">
                  <div className="procurement-process-field-with-label">
                    <label>Supplier Invoice Date</label>
                    <input
                      type="date"
                      value={grnForm.supplier_invoice_date}
                      onChange={(e) => setGrnForm((p) => ({ ...p, supplier_invoice_date: e.target.value }))}
                    />
                  </div>
                  <div className="procurement-process-field-with-label">
                    <label>Delivery Note / Waybill No.</label>
                    <input
                      value={grnForm.delivery_note_waybill_no}
                      onChange={(e) => setGrnForm((p) => ({ ...p, delivery_note_waybill_no: e.target.value }))}
                      placeholder="Waybill No."
                    />
                  </div>
                </div>
                <div className="procurement-process-row-two">
                  <div className="procurement-process-field-with-label">
                    <label>Vehicle / Transport</label>
                    <input
                      value={grnForm.vehicle_no_transport}
                      onChange={(e) => setGrnForm((p) => ({ ...p, vehicle_no_transport: e.target.value }))}
                      placeholder="Vehicle No."
                    />
                  </div>
                  <div className="procurement-process-field-with-label">
                    <label>Received by (Name & Designation)</label>
                    <input
                      value={grnForm.received_by_name}
                      onChange={(e) => setGrnForm((p) => ({ ...p, received_by_name: e.target.value }))}
                      placeholder="Name"
                    />
                  </div>
                </div>
                <div className="procurement-process-row-two">
                  <div className="procurement-process-field-with-label">
                    <label>Inspected by</label>
                    <input
                      value={grnForm.inspected_by_name}
                      onChange={(e) => setGrnForm((p) => ({ ...p, inspected_by_name: e.target.value }))}
                      placeholder="Inspector Name"
                    />
                  </div>
                  <div className="procurement-process-field-with-label">
                    <label>Inspection Condition</label>
                    <select
                      value={grnForm.inspection_condition}
                      onChange={(e) => setGrnForm((p) => ({ ...p, inspection_condition: e.target.value }))}
                    >
                      <option value="good_condition">Good condition</option>
                      <option value="with_discrepancies">With discrepancies</option>
                    </select>
                  </div>
                </div>
                <div>
                  <div className="procurement-process-field-with-label">
                    <label>Discrepancies / Damages / Rejections</label>
                    <textarea
                      rows={2}
                      value={grnForm.discrepancies_notes}
                      onChange={(e) => setGrnForm((p) => ({ ...p, discrepancies_notes: e.target.value }))}
                      placeholder="Discrepancies, damages, rejections..."
                    />
                  </div>
                  <div className="procurement-process-field-with-label">
                    <label>Shortage / Excess explanation</label>
                    <textarea
                      rows={2}
                      value={grnForm.shortage_excess_notes}
                      onChange={(e) => setGrnForm((p) => ({ ...p, shortage_excess_notes: e.target.value }))}
                      placeholder="Shortage or excess explanation..."
                    />
                  </div>
                  <div className="procurement-process-field-with-label">
                    <label>Verified by / Approved by (Names)</label>
                    <div className="procurement-process-row-two">
                      <input
                        value={grnForm.verified_by_name}
                        onChange={(e) => setGrnForm((p) => ({ ...p, verified_by_name: e.target.value }))}
                        placeholder="Verified by"
                      />
                      <input
                        value={grnForm.approved_by_name}
                        onChange={(e) => setGrnForm((p) => ({ ...p, approved_by_name: e.target.value }))}
                        placeholder="Approved by"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Item rows */}
              <strong>Items</strong>
              <table width="100%" cellPadding="6">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Received</th>
                    <th>Rejected</th>
                    <th>Damaged</th>
                    <th>Remarks / Condition</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPurchaseOrder.items.map((item) => {
                    const poQty = Number(item.quantity) || 0;
                    const alreadyReceived = Number(item.received_qty) || 0;
                    const pending = Math.max(0, poQty - alreadyReceived);
                    return (
                    <tr key={item.id}>
                      <td>
                        {item.item_code} - {item.item_name}
                        <div className="procurement-process-step-desc">PO Qty: {item.quantity} | Received: {item.received_qty} | <strong>Pending: {pending}</strong></div>
                      </td>
                      <td>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          max={pending}
                          step="0.01"
                          placeholder="0"
                          title={`Max: ${pending}`}
                          value={grnItemMap[item.id]?.received_qty ?? ''}
                          onChange={(e) => setGrnItemMap((prev) => ({
                            ...prev,
                            [item.id]: { ...(prev[item.id] || {}), received_qty: e.target.value },
                          }))}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          placeholder="0"
                          title="Qty rejected"
                          value={grnItemMap[item.id]?.rejected_qty ?? ''}
                          onChange={(e) => setGrnItemMap((prev) => ({
                            ...prev,
                            [item.id]: { ...(prev[item.id] || {}), rejected_qty: e.target.value },
                          }))}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          placeholder="0"
                          title="Qty damaged"
                          value={grnItemMap[item.id]?.damaged_qty ?? ''}
                          onChange={(e) => setGrnItemMap((prev) => ({
                            ...prev,
                            [item.id]: { ...(prev[item.id] || {}), damaged_qty: e.target.value },
                          }))}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={grnItemMap[item.id]?.remarks_condition_damage ?? ''}
                          onChange={(e) => setGrnItemMap((prev) => ({
                            ...prev,
                            [item.id]: { ...(prev[item.id] || {}), remarks_condition_damage: e.target.value },
                          }))}
                          placeholder="Condition / Damage notes"
                          style={{ minWidth: 120 }}
                        />
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              <button type="button" disabled={creatingGrn} onClick={handleCreateGrn}>
                {creatingGrn ? 'Posting GRN...' : 'Post GRN'}
              </button>
            </div>
            </>
          )}

          <table width="100%" cellPadding="6">
            <thead>
              <tr>
                <th>GRN No</th>
                <th>PO</th>
                <th>Status</th>
                <th>Received Date</th>
                <th>Items</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {grns.map((grn) => (
                <tr key={grn.id}>
                  <td>{grn.grn_no}</td>
                  <td>{grn.po_no}</td>
                  <td>{grn.status}</td>
                  <td>{formatDateDisplay(grn.received_date || grn.created_at)}</td>
                  <td>{grn.item_count}</td>
                  <td>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => handleDownloadGrn(grn.id)}
                    >
                      Download GRN
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </AdminStockPage>
  );
};

export default ProcurementProcess;

