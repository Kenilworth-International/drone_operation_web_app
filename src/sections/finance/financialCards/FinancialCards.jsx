import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaCreditCard, FaPlus, FaEdit, FaTrash, FaArrowUp, FaArrowDown, FaHistory, FaEye, FaFileInvoice, FaPrint, FaUpload, FaSearch, FaReceipt, FaBan } from 'react-icons/fa';
import {
  useGetUsersQuery,
  useGetOwnVehiclesQuery,
  useGetCardsQuery,
  useGetBanksQuery,
  useGetFinanceCategoriesQuery,
  useGetFinanceSubCategoriesQuery,
  useGetTransactionsQuery,
  useCreateCardMutation,
  useUpdateCardMutation,
  useDeleteCardMutation,
  useGetCardTransactionsQuery,
  useCreateTransactionMutation,
  useVerifySecurityCodeAndGetCardMutation,
  useGetPendingSettlementsQuery,
  useSettleTransactionMutation,
} from '../../../api/services NodeJs/financialCardsApi';
import {
  useCreateFuelTransportVoucherMutation,
  useDeclineFuelTransportVoucherByFinanceMutation,
  useGetFuelTransportVoucherHistoryQuery,
  useGetFuelTransportVoucherByIdQuery,
  useRecordFuelTransportPhysicalApprovalMutation,
} from '../../../api/services NodeJs/fuelTransportVoucherApi';
import {
  useCreateFuelGeneratorVoucherMutation,
  useDeclineFuelGeneratorVoucherByFinanceMutation,
  useGetFuelGeneratorVoucherHistoryQuery,
  useGetFuelGeneratorVoucherByIdQuery,
  useRecordFuelGeneratorPhysicalApprovalMutation,
} from '../../../api/services NodeJs/fuelGeneratorVoucherApi';
import { useSendMessageMutation } from '../../../api/services/authApi';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import TransportVoucherPrint from './TransportVoucherPrint';
import { formatFuelVoucherDescription } from './fuelVoucherDescription';
import {
  getVoucherApprovalTypeLabel,
  getVoucherApprovedBy,
  getVoucherDecidedBy,
  isPdfProofUrl,
  voucherStatusLabel,
} from './fuelTransportVoucherUi';
import { groupDriverLabel } from './transportVoucherPrintUtils';
import { FEATURE_CODES } from '../../../utils/featurePermissions';
import { isInternalDeveloper } from '../../../utils/authUtils';
import { useGetMyPermissionsQuery } from '../../../api/services NodeJs/featurePermissionsApi';
import '../../../styles/financialCards.css';

const VOUCHER_ELIGIBLE_STATUSES = ['not_create', 'declined'];
const FINANCE_DECLINE_ELIGIBLE_STATUSES = ['not_create', 'declined'];
const HIDDEN_SETTLEMENT_STATUSES = ['approved', 'finance_declined'];
const HISTORY_STATUS_FILTERS = new Set(['pending', 'approved', 'declined']);

const isFinanceDeclinedVoucher = (voucher) =>
  voucher?.status === 'declined' && voucher?.approval_mode === 'finance';

const SETTLEMENT_PROOF_MAX_BYTES = 10 * 1024 * 1024;
const SETTLEMENT_PROOF_MAX_LABEL = '10 MB';
const FINANCIAL_CARDS_REFRESH_MS = 5 * 60 * 1000;

const formatRefreshClock = (value) => {
  if (!value) return '—';
  return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const formatProofFileSize = (bytes) => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const fileToDataUri = (file) =>
  new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const toMonthKey = (value) => {
  if (!value) return '';
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text) || !text.includes('T')) return text.slice(0, 7);
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return text.slice(0, 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonthLabel = (key) => {
  const [y, m] = String(key).split('-').map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
};

const selectProofImageFile = (file, onSelect, inputEl = null) => {
  if (!file) {
    onSelect(null);
    return;
  }
  if (file.size > SETTLEMENT_PROOF_MAX_BYTES) {
    toast.error(`File is too large. Maximum size is ${SETTLEMENT_PROOF_MAX_LABEL}.`);
    if (inputEl) inputEl.value = '';
    return;
  }
  onSelect(file);
};

function SettlementCheckbox({ checked, indeterminate = false, onChange, ariaLabel }) {
  const inputRef = useRef(null);
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  }, [indeterminate, checked]);
  return (
    <input
      ref={inputRef}
      type="checkbox"
      className="settlement-row-checkbox-financial-cards"
      checked={checked}
      onChange={onChange}
      aria-label={ariaLabel}
    />
  );
}

/** Strip commas and keep digits + at most one decimal point (for limitation / balance fields). */
function sanitizeAmountInput(raw) {
  let s = String(raw ?? '').replace(/,/g, '').replace(/[^\d.]/g, '');
  const dot = s.indexOf('.');
  if (dot !== -1) {
    s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '');
  }
  return s;
}

/** Show values like 500,000 or 1,234.56 while typing. */
function formatThousandsDisplay(sanitized) {
  if (sanitized === '' || sanitized === undefined || sanitized === null) return '';
  if (sanitized === '.') return '0.';
  const hasDot = sanitized.includes('.');
  const [intRaw = '', decPart = ''] = sanitized.split('.');
  const intDigits = intRaw.replace(/\D/g, '');
  const commaInt = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (hasDot) {
    const d = decPart.replace(/\D/g, '').slice(0, 2);
    const lead = commaInt === '' ? '0' : commaInt;
    return d.length > 0 ? `${lead}.${d}` : `${lead}.`;
  }
  return commaInt;
}

function parseAmountField(value) {
  const s = sanitizeAmountInput(value);
  if (s === '' || s === '.') return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function numberToAmountString(v) {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return String(n);
}

const FinancialCards = () => {
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');
  const userId = userData?.id || null;
  const isDeveloper = isInternalDeveloper(userData);
  const { data: featurePermissionsData = {} } = useGetMyPermissionsQuery(undefined, {
    skip: !userId,
  });

  const checkFeatureAccess = (featureCode) => {
    if (isDeveloper) return true;
    if (!featurePermissionsData || typeof featurePermissionsData !== 'object') return false;
    if (featurePermissionsData.features && featurePermissionsData.features[featureCode] === true) {
      return true;
    }
    const categories = featurePermissionsData.categories || featurePermissionsData;
    for (const category in categories) {
      if (category === 'paths' || category === 'features') continue;
      const categoryData = categories[category];
      if (Array.isArray(categoryData) && categoryData.includes(featureCode)) {
        return true;
      }
    }
    return false;
  };

  const hasCreateVoucherFeature = checkFeatureAccess(FEATURE_CODES.FINANCIAL_CARDS_CREATE_VOUCHER);
  const navigate = useNavigate();
  const routerLocation = useLocation();

  const [showCardModal, setShowCardModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showCardDetails, setShowCardDetails] = useState(false);
  const [showSecurityCodeModal, setShowSecurityCodeModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [editingCard, setEditingCard] = useState(null);
  const [flippedCardId, setFlippedCardId] = useState(null);
  const [securityCode, setSecurityCode] = useState('');
  const [decryptedCards, setDecryptedCards] = useState({}); // Store decrypted card data by card ID
  const [securityCodeError, setSecurityCodeError] = useState('');
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [selectedTransactionIds, setSelectedTransactionIds] = useState([]);
  const [settlementDescription, setSettlementDescription] = useState('');
  const [settlementImage, setSettlementImage] = useState(null);
  const [settlementFilter, setSettlementFilter] = useState('all'); // 'all', 'card', 'amount'
  const [settlementSearch, setSettlementSearch] = useState('');
  const [settlementMonth, setSettlementMonth] = useState('');
  const [settlementVoucherStatus, setSettlementVoucherStatus] = useState('all');
  const [cardFormData, setCardFormData] = useState({
    no: '',
    cvc: '',
    card_holder: '',
    exp_date: '',
    category: '',
    limitation: '',
    amount: '',
    bank_id: '',
    user: '',
    vehicle_id: '',
    sub_category: '',
  });

  const { data: cardsData, isLoading: cardsLoading, refetch: refetchCards } = useGetCardsQuery();
  const { data: usersData } = useGetUsersQuery();
  const { data: ownVehiclesData } = useGetOwnVehiclesQuery();
  const { data: banksData } = useGetBanksQuery();
  const { data: categoriesData } = useGetFinanceCategoriesQuery();
  const { data: fuelSubCategoriesData = [] } = useGetFinanceSubCategoriesQuery(
    { finance_category: 1 },
    { skip: !showCardModal && String(cardFormData.category) !== '1' }
  );
  const { data: allTransactionsData } = useGetTransactionsQuery();
  const [createCard, { isLoading: creatingCard }] = useCreateCardMutation();
  const [updateCard, { isLoading: updatingCard }] = useUpdateCardMutation();
  const [deleteCard] = useDeleteCardMutation();
  const [createTransaction, { isLoading: creatingTransaction }] = useCreateTransactionMutation();
  const [verifySecurityCode] = useVerifySecurityCodeAndGetCardMutation();
  const { data: pendingSettlementsData, refetch: refetchSettlements } = useGetPendingSettlementsQuery();
  const [settleTransaction, { isLoading: isSettling }] = useSettleTransactionMutation();
  const [sendMessage] = useSendMessageMutation();
  const [createFuelVoucher, { isLoading: creatingVoucher }] = useCreateFuelTransportVoucherMutation();
  const [declineFuelVoucherByFinance, { isLoading: decliningFinanceVoucher }] =
    useDeclineFuelTransportVoucherByFinanceMutation();
  const [recordPhysicalApproval, { isLoading: recordingPhysicalApproval }] =
    useRecordFuelTransportPhysicalApprovalMutation();
  const { data: voucherHistory = [], refetch: refetchVoucherHistory } = useGetFuelTransportVoucherHistoryQuery();
  const [createGeneratorFuelVoucher, { isLoading: creatingGeneratorVoucher }] =
    useCreateFuelGeneratorVoucherMutation();
  const [declineGeneratorFuelVoucherByFinance, { isLoading: decliningGeneratorFinanceVoucher }] =
    useDeclineFuelGeneratorVoucherByFinanceMutation();
  const [recordGeneratorPhysicalApproval, { isLoading: recordingGeneratorPhysicalApproval }] =
    useRecordFuelGeneratorPhysicalApprovalMutation();
  const { data: generatorVoucherHistory = [], refetch: refetchGeneratorVoucherHistory } =
    useGetFuelGeneratorVoucherHistoryQuery();

  // Top-level tab: 'cards' (card view) or 'settlements' (transactions to settle)
  const [activeTab, setActiveTab] = useState('cards');
  const [settlementsSubTab, setSettlementsSubTab] = useState('pending');
  const [fuelSettlementSource, setFuelSettlementSource] = useState('vehicle');

  const [pendingViewCard, setPendingViewCard] = useState(null);

  const [selectedTxIds, setSelectedTxIds] = useState([]);
  const [showCreateVoucherModal, setShowCreateVoucherModal] = useState(false);
  const [showDeclineVoucherModal, setShowDeclineVoucherModal] = useState(false);
  const [declineVoucherReason, setDeclineVoucherReason] = useState('');
  const [printVoucher, setPrintVoucher] = useState(null);
  const [physicalApprovalVoucher, setPhysicalApprovalVoucher] = useState(null);
  const [physicalApproverId, setPhysicalApproverId] = useState('');
  const [physicalApprovalImage, setPhysicalApprovalImage] = useState(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [isRefreshingFinancialCards, setIsRefreshingFinancialCards] = useState(false);
  const [settlementProofPreviewUrl, setSettlementProofPreviewUrl] = useState(null);
  const [detailVoucherId, setDetailVoucherId] = useState(null);
  const { data: voucherDetailData } = useGetFuelTransportVoucherByIdQuery(detailVoucherId, {
    skip: !detailVoucherId || fuelSettlementSource !== 'vehicle',
  });
  const { data: generatorVoucherDetailData } = useGetFuelGeneratorVoucherByIdQuery(detailVoucherId, {
    skip: !detailVoucherId || fuelSettlementSource !== 'generator',
  });

  useEffect(() => {
    const detail = fuelSettlementSource === 'generator' ? generatorVoucherDetailData : voucherDetailData;
    if (detail && detailVoucherId) {
      setPrintVoucher(detail);
      setDetailVoucherId(null);
    }
  }, [voucherDetailData, generatorVoucherDetailData, detailVoucherId, fuelSettlementSource]);

  const refreshAllFinancialCardsData = useCallback(async ({ showSpinner = true } = {}) => {
    if (showSpinner) setIsRefreshingFinancialCards(true);
    try {
      await Promise.all([
        refetchCards(),
        refetchSettlements(),
        refetchVoucherHistory(),
        refetchGeneratorVoucherHistory(),
      ]);
      setLastRefreshedAt(new Date());
    } finally {
      if (showSpinner) setIsRefreshingFinancialCards(false);
    }
  }, [refetchCards, refetchSettlements, refetchVoucherHistory, refetchGeneratorVoucherHistory]);

  useEffect(() => {
    if (lastRefreshedAt) return;
    if (!cardsLoading && pendingSettlementsData != null) {
      setLastRefreshedAt(new Date());
    }
  }, [cardsLoading, pendingSettlementsData, lastRefreshedAt]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      void refreshAllFinancialCardsData({ showSpinner: false });
    }, FINANCIAL_CARDS_REFRESH_MS);
    return () => window.clearInterval(timerId);
  }, [refreshAllFinancialCardsData]);

  const toggleGlobalSelection = (txId) => {
    setSelectedTxIds((prev) =>
      prev.includes(txId) ? prev.filter((id) => id !== txId) : [...prev, txId]
    );
  };
  const toggleGroupSelection = (groupIds) => {
    setSelectedTxIds((prev) => {
      const allInGroupSelected = groupIds.every((id) => prev.includes(id));
      if (allInGroupSelected) {
        return prev.filter((id) => !groupIds.includes(id));
      }
      const next = new Set(prev);
      groupIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  };

  const toggleSelectAllVisible = (visibleIds) => {
    setSelectedTxIds((prev) => {
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prev.includes(id));
      if (allSelected) {
        return prev.filter((id) => !visibleIds.includes(id));
      }
      const next = new Set(prev);
      visibleIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  };

  const cards = cardsData || [];
  const users = usersData || [];
  const getCardLast4 = (cardLike) => {
    const raw = String(cardLike?.no || cardLike?.card_number || '').trim();
    const m = raw.match(/(\d{4})(?!.*\d)/);
    return m ? m[1] : null;
  };

  const getCardHolderMobile = (cardLike) => {
    const cardUserId = Number(cardLike?.user || cardLike?.user_id || 0);
    if (!cardUserId) return null;
    const holder = users.find((u) => Number(u.id) === cardUserId);
    return holder?.mobile_no || null;
  };

  const notifyCardTopup = async (cardLike) => {
    const mobileNo = String(getCardHolderMobile(cardLike) || '').trim();
    const last4 = getCardLast4(cardLike);
    if (!mobileNo || !last4) return;
    await sendMessage({
      mobile_no: mobileNo,
      content: `DSMS notice: Topup successful for your card ending ${last4}.`,
    }).unwrap();
  };

  const notifyCardSettlement = async (cardLike) => {
    const mobileNo = String(getCardHolderMobile(cardLike) || '').trim();
    const last4 = getCardLast4(cardLike);
    if (!mobileNo || !last4) return;
    await sendMessage({
      mobile_no: mobileNo,
      content: `DSMS notice: Settlement posted to your card ending ${last4}.`,
    }).unwrap();
  };

  const banks = banksData || [];
  const categories = categoriesData || [];
  const fuelSubCategories = fuelSubCategoriesData || [];
  const selectedFuelSubType = String(
    fuelSubCategories.find((s) => String(s.id) === String(cardFormData.sub_category))?.type || ''
  ).toLowerCase();
  const ownVehicles = ownVehiclesData || [];
  const allTransactions = allTransactionsData || [];
  const pendingSettlements = pendingSettlementsData || [];

  const { data: transactionsData } = useGetCardTransactionsQuery(selectedCard?.id, {
    skip: !selectedCard,
  });
  const transactions = transactionsData || [];

  const handleOpenCardModal = (card = null) => {
    if (card) {
      setEditingCard(card);
      
      // Format exp_date for date input (yyyy-MM-dd)
      let formattedExpDate = '';
      if (card.exp_date) {
        try {
          const date = new Date(card.exp_date);
          if (!isNaN(date.getTime())) {
            formattedExpDate = date.toISOString().split('T')[0];
          }
        } catch (e) {
          // If it's already in yyyy-MM-dd format, use it as is
          formattedExpDate = card.exp_date.split('T')[0] || card.exp_date;
        }
      }
      
      // Check if card number is in old encrypted format (hex without colons)
      const isOldEncryptedFormat = (value) => {
        if (!value) return false;
        const cleaned = value.replace(/\s/g, '');
        // Old format: hex string without colons, length > 20
        return /^[0-9a-f]+$/i.test(cleaned) && cleaned.length > 20 && !value.includes(':');
      };
      
      // Edit: PAN is shown read-only (masked from API). Never put it in cardFormData.no — that field is add-only.
      const cardCvc = (card.cvc && !isOldEncryptedFormat(card.cvc) && card.cvc !== '***' && card.cvc !== 'N/A') 
        ? card.cvc 
        : '';
      
      // Show alert if old encrypted format detected
      if (isOldEncryptedFormat(card.no) || isOldEncryptedFormat(card.cvc)) {
        setTimeout(() => {
          toast.warn('This card has old encrypted data. Please re-enter the CVC to update it with the new encryption format.');
        }, 100);
      }
      
      setCardFormData({
        no: '',
        cvc: cardCvc,
        card_holder: card.card_holder || '',
        exp_date: formattedExpDate,
        category: card.category ? String(card.category) : '',
        limitation: numberToAmountString(card.limitation),
        amount: numberToAmountString(card.amount),
        bank_id: card.bank_id ? String(card.bank_id) : '',
        user: card.user ? String(card.user) : '',
        vehicle_id: card.vehicle_id ? String(card.vehicle_id) : '',
        sub_category: card.sub_category ? String(card.sub_category) : '',
      });
    } else {
      setEditingCard(null);
      setCardFormData({
        no: '',
        cvc: '',
        card_holder: '',
        exp_date: '',
        category: '',
        limitation: '',
        amount: '',
        bank_id: '',
        user: '',
        vehicle_id: '',
        sub_category: '',
      });
    }
    setShowCardModal(true);
  };

  const handleCloseCardModal = () => {
    setShowCardModal(false);
    setEditingCard(null);
    setCardFormData({
      no: '',
      cvc: '',
      card_holder: '',
      exp_date: '',
      category: '',
      limitation: '',
      amount: '',
      bank_id: '',
      user: '',
      vehicle_id: '',
      sub_category: '',
    });
  };

  const handleSubmitCard = async (e) => {
    e.preventDefault();

    const digitsOnlyNo = (cardFormData.no || '').replace(/\s/g, '');
    const looksMaskedPan = digitsOnlyNo.includes('*') || digitsOnlyNo.includes('•');

    if (!editingCard) {
      if (!digitsOnlyNo || !/^\d{13,19}$/.test(digitsOnlyNo)) {
        toast.warn('Card number must be between 13 and 19 digits');
        return;
      }
    }
    // Edit: PAN is not collected in the form — never send card number on update.

    // Validate CVC only when user entered digits (not *** from API)
    if (cardFormData.cvc) {
      const cvc = cardFormData.cvc.trim();
      if (!/^\d+$/.test(cvc)) {
        toast.warn('CVC must be 3 or 4 digits');
        return;
      }
      if (!/^\d{3,4}$/.test(cvc)) {
        toast.warn('CVC must be 3 or 4 digits');
        return;
      }
    }

    try {
      const cleanedCardNo =
        !editingCard && digitsOnlyNo && !looksMaskedPan ? digitsOnlyNo : null;
      const trimmedCvc = cardFormData.cvc ? cardFormData.cvc.trim() : '';

      const isFuelCategory = String(cardFormData.category) === '1';
      const selectedSub = fuelSubCategories.find(
        (s) => String(s.id) === String(cardFormData.sub_category)
      );
      const subType = String(selectedSub?.type || '').toLowerCase();
      const cardData = {
        ...cardFormData,
        category: cardFormData.category ? parseInt(cardFormData.category) : null,
        sub_category:
          isFuelCategory && cardFormData.sub_category
            ? parseInt(cardFormData.sub_category, 10)
            : null,
        limitation: parseAmountField(cardFormData.limitation),
        amount: parseAmountField(cardFormData.amount),
        bank_id: cardFormData.bank_id ? parseInt(cardFormData.bank_id) : null,
        user: cardFormData.user ? parseInt(cardFormData.user) : null,
        vehicle_id:
          isFuelCategory && subType === 'vehicle' && cardFormData.vehicle_id
            ? parseInt(cardFormData.vehicle_id, 10)
            : null,
      };

      // Partial update: only send PAN/CVC when replacing with a full valid value.
      // Sending null used to clear the encrypted column — avoid that when only editing e.g. limitation.
      if (editingCard) {
        delete cardData.no;
        if (trimmedCvc && /^\d{3,4}$/.test(trimmedCvc)) {
          cardData.cvc = trimmedCvc;
        } else {
          delete cardData.cvc;
        }
      } else {
        cardData.no = cleanedCardNo;
        cardData.cvc = trimmedCvc || null;
      }

      if (editingCard) {
        await updateCard({ id: editingCard.id, ...cardData }).unwrap();
      } else {
        await createCard(cardData).unwrap();
      }
      handleCloseCardModal();
      refetchCards();
    } catch (error) {
      toast.error(error?.data?.message || 'Failed to save card');
    }
  };

  const handleDeleteCard = async (cardId) => {
    if (window.confirm('Are you sure you want to deactivate this card?')) {
      try {
        await deleteCard(cardId).unwrap();
        refetchCards();
      } catch (error) {
        toast.error(error?.data?.message || 'Failed to delete card');
      }
    }
  };

  const handleViewCardDetails = (card) => {
    // Check if we already have decrypted data for this card
    if (decryptedCards[card.id]) {
      setSelectedCard(decryptedCards[card.id]);
      setShowCardDetails(true);
    } else {
      // Show security code modal first
      setSelectedCard(card);
      setShowSecurityCodeModal(true);
    }
  };

  const handleVerifySecurityCode = async () => {
    if (!selectedCard || !securityCode || securityCode.length !== 4) {
      setSecurityCodeError('Please enter a valid 4-digit security code');
      return;
    }

    // Clear any previous error
    setSecurityCodeError('');

    try {
      const result = await verifySecurityCode({
        card_id: selectedCard.id,
        security_code: securityCode,
      }).unwrap();

      if (result.status === 'success' && result.data) {
        // Store decrypted card data
        setDecryptedCards((prev) => ({
          ...prev,
          [selectedCard.id]: result.data,
        }));
        setSelectedCard(result.data);
        setShowSecurityCodeModal(false);
        setSecurityCode('');
        setSecurityCodeError('');
        setShowCardDetails(true);
      }
    } catch (error) {
      setSecurityCodeError(error?.data?.message || 'Invalid security code. Please try again.');
      setSecurityCode('');
    }
  };

  const handleCloseCardDetails = () => {
    setShowCardDetails(false);
    setSelectedCard(null);
  };

  const handleOpenTransactionModal = (card, type) => {
    setSelectedCard(card);
    setTransactionType(type);
    setTransactionFormData({
      amount: '',
      description: '',
      image: null,
    });
    setShowTransactionModal(true);
  };

  const [transactionType, setTransactionType] = useState('add');
  const [transactionFormData, setTransactionFormData] = useState({
    amount: '',
    description: '',
    image: null,
  });

  const handleCloseTransactionModal = () => {
    setShowTransactionModal(false);
    setSelectedCard(null);
    setTransactionFormData({
      amount: '',
      description: '',
      image: null,
    });
  };

  const handleSubmitTransaction = async (e) => {
    e.preventDefault();
    if (!selectedCard) return;

    try {
      // Encode the optional receipt as a base64 data URI; the backend persists
      // it to uploads/fuel_bill and stores only the filename in transactions.image.
      const fileToDataUri = (file) =>
        new Promise((resolve, reject) => {
          if (!file) return resolve(null);
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
      const imageDataUri = await fileToDataUri(transactionFormData.image);

      await createTransaction({
        card: selectedCard.id,
        type: transactionType,
        amount: parseFloat(transactionFormData.amount),
        description: transactionFormData.description,
        image: imageDataUri,
      }).unwrap();

      if (transactionType === 'add') {
        try {
          await notifyCardTopup(selectedCard);
        } catch (_) {
          // Do not block transaction success if SMS fails.
        }
      }

      handleCloseTransactionModal();
      if (showCardDetails) {
        // Refetch transactions
        refetchCards();
      }
    } catch (error) {
      toast.error(error?.data?.message || 'Failed to create transaction');
    }
  };

  // Calculate card balance
  const calculateBalance = (cardId) => {
    // Use allTransactions for card list, transactions for details view
    const transactionsToUse = selectedCard && selectedCard.id === cardId ? transactions : allTransactions;
    const cardTransactions = transactionsToUse.filter((t) => t.card === cardId || t.card === parseInt(cardId));
    return cardTransactions.reduce((balance, transaction) => {
      if (transaction.type === 'add') {
        return balance + (parseFloat(transaction.amount) || 0);
      } else if (transaction.type === 'use') {
        return balance - (parseFloat(transaction.amount) || 0);
      }
      return balance;
    }, 0);
  };

  const handleOpenSettlementModal = (settlement, selection = null) => {
    setSelectedSettlement(settlement);

    // Selection can be: a single id (number/string), an array of ids, or null
    // (= settle all transactions for the card).
    let ids = [];
    if (Array.isArray(selection)) {
      ids = selection.slice();
    } else if (selection != null) {
      ids = [selection];
    } else {
      ids = settlement.transactions.map((t) => t.id);
    }

    const total = settlement.transactions
      .filter((t) => ids.includes(t.id))
      .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

    setSettlementAmount(total.toFixed(2));
    setSelectedTransactionIds(ids);
    setShowSettlementModal(true);
  };

  const handleCloseSettlementModal = () => {
    setShowSettlementModal(false);
    setSelectedSettlement(null);
    setSettlementAmount('');
    setSelectedTransactionIds([]);
    setSettlementDescription('');
    setSettlementImage(null);
  };

  const handleToggleTransaction = (transactionId) => {
    setSelectedTransactionIds(prev => {
      if (prev.includes(transactionId)) {
        return prev.filter(id => id !== transactionId);
      } else {
        return [...prev, transactionId];
      }
    });
  };

  const handleSettle = async (e) => {
    e.preventDefault();
    if (!selectedSettlement || !settlementAmount || parseFloat(settlementAmount) <= 0) {
      toast.warn('Please enter a valid settlement amount');
      return;
    }

    if (selectedTransactionIds.length === 0) {
      toast.warn('Please select at least one transaction to settle');
      return;
    }

    try {
      await settleTransaction({
        card_id: selectedSettlement.card_id,
        transaction_ids: selectedTransactionIds,
        settlement_amount: parseFloat(settlementAmount),
      }).unwrap();
      
      // Create a topup transaction for the settlement amount (marked as settlement)
      await createTransaction({
        card: selectedSettlement.card_id,
        type: 'add',
        amount: parseFloat(settlementAmount),
        description: settlementDescription || `Settlement for ${selectedTransactionIds.length} transaction(s)`,
        image: settlementImage ? settlementImage.name : null,
        is_settlement: true,
      }).unwrap();

      try {
        const cardForNotify = cards.find((c) => Number(c.id) === Number(selectedSettlement.card_id));
        if (cardForNotify) await notifyCardSettlement(cardForNotify);
      } catch (_) {
        // Keep settlement flow successful even if SMS fails.
      }
      
      refetchCards();
      refetchSettlements();
      handleCloseSettlementModal();
    } catch (error) {
      console.error('Error settling transactions:', error);
      toast.error(error.data?.message || error.message || 'Error settling transactions');
    }
  };

  const vehicleFuelSettlementRows = useMemo(() => {
    const rows = [];
    pendingSettlements.forEach((settlement) => {
      settlement.transactions.forEach((transaction) => {
        if (
          transaction.type !== 'use' ||
          Number(transaction.approved) !== 1 ||
          transaction.fuel_record_id == null ||
          transaction.fuel_record_id === '' ||
          HIDDEN_SETTLEMENT_STATUSES.includes(transaction.voucher_status)
        ) {
          return;
        }
        rows.push({
          ...transaction,
          card_id: settlement.card_id,
          card_holder: settlement.card_holder,
          card_number: settlement.card_number,
          current_amount: settlement.current_amount,
          voucher_status: transaction.voucher_status || 'not_create',
          voucher_id: transaction.voucher_id || null,
          voucher_no: transaction.voucher_no || null,
        });
      });
    });
    return rows;
  }, [pendingSettlements]);

  const generatorFuelSettlementRows = useMemo(() => {
    const rows = [];
    pendingSettlements.forEach((settlement) => {
      settlement.transactions.forEach((transaction) => {
        if (
          transaction.type !== 'use' ||
          Number(transaction.approved) !== 1 ||
          transaction.generator_fuel_record_id == null ||
          transaction.generator_fuel_record_id === '' ||
          HIDDEN_SETTLEMENT_STATUSES.includes(transaction.voucher_status)
        ) {
          return;
        }
        rows.push({
          ...transaction,
          card_id: settlement.card_id,
          card_holder: settlement.card_holder,
          card_number: settlement.card_number,
          current_amount: settlement.current_amount,
          voucher_status: transaction.voucher_status || 'not_create',
          voucher_id: transaction.voucher_id || null,
          voucher_no: transaction.voucher_no || null,
        });
      });
    });
    return rows;
  }, [pendingSettlements]);

  const fuelSettlementRows =
    fuelSettlementSource === 'generator' ? generatorFuelSettlementRows : vehicleFuelSettlementRows;

  const activeVoucherHistory = useMemo(() => {
    const raw = fuelSettlementSource === 'generator' ? generatorVoucherHistory : voucherHistory;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.data)) return raw.data;
    if (Array.isArray(raw?.vouchers)) return raw.vouchers;
    return [];
  }, [fuelSettlementSource, generatorVoucherHistory, voucherHistory]);
  const isCreatingVoucher =
    fuelSettlementSource === 'generator' ? creatingGeneratorVoucher : creatingVoucher;
  const isDecliningFinanceVoucher =
    fuelSettlementSource === 'generator' ? decliningGeneratorFinanceVoucher : decliningFinanceVoucher;
  const isRecordingPhysicalApproval =
    fuelSettlementSource === 'generator' ? recordingGeneratorPhysicalApproval : recordingPhysicalApproval;

  const settlementMonthOptions = useMemo(() => {
    const keys = new Set();
    activeVoucherHistory.forEach((voucher) => {
      if (isFinanceDeclinedVoucher(voucher)) return;
      const key = toMonthKey(voucher.created_at);
      if (key) keys.add(key);
    });
    if (settlementMonth) keys.add(settlementMonth);
    return [...keys].sort().reverse();
  }, [activeVoucherHistory, settlementMonth]);

  // To Settle: all months, no status filter — only text search
  const filteredFuelRows = useMemo(() => {
    const q = settlementSearch.toLowerCase();
    if (!q) return fuelSettlementRows;
    return fuelSettlementRows.filter(
      (t) =>
        t.driver_name?.toLowerCase().includes(q) ||
        t.card_holder?.toLowerCase().includes(q) ||
        t.card_number?.toLowerCase().includes(q) ||
        t.fuel_description?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        String(t.fuel_liters ?? t.quantity ?? '').includes(q) ||
        String(t.amount || '').includes(q) ||
        t.voucher_no?.toLowerCase().includes(q)
    );
  }, [fuelSettlementRows, settlementSearch]);

  // Voucher History: full history (except finance-declined), with month + status filters
  const voucherHistoryRows = useMemo(() => {
    const q = settlementSearch.trim().toLowerCase();
    const statusFilter = HISTORY_STATUS_FILTERS.has(settlementVoucherStatus)
      ? settlementVoucherStatus
      : 'all';
    return activeVoucherHistory.filter((voucher) => {
      if (isFinanceDeclinedVoucher(voucher)) return false;
      if (settlementMonth && toMonthKey(voucher.created_at) !== settlementMonth) return false;
      if (statusFilter !== 'all' && voucher.status !== statusFilter) return false;
      if (!q) return true;
      return (
        voucher.voucher_no?.toLowerCase().includes(q) ||
        String(voucher.total_amount || '').includes(q) ||
        getVoucherDecidedBy(voucher).toLowerCase().includes(q)
      );
    });
  }, [activeVoucherHistory, settlementMonth, settlementVoucherStatus, settlementSearch]);

  const groupedFuelRows = useMemo(() => {
    const map = {};
    filteredFuelRows.forEach((row) => {
      if (!map[row.card_id]) {
        map[row.card_id] = {
          card_id: row.card_id,
          card_holder: row.card_holder,
          card_number: row.card_number,
          transactions: [],
        };
      }
      map[row.card_id].transactions.push(row);
    });
    return Object.values(map);
  }, [filteredFuelRows]);

  const visibleTxIds = useMemo(
    () => filteredFuelRows.map((row) => row.id),
    [filteredFuelRows]
  );

  const visibleAllSelected =
    visibleTxIds.length > 0 && visibleTxIds.every((id) => selectedTxIds.includes(id));
  const visibleSomeSelected =
    visibleTxIds.some((id) => selectedTxIds.includes(id)) && !visibleAllSelected;

  const selectedEligibleRows = useMemo(
    () =>
      fuelSettlementRows.filter(
        (row) =>
          selectedTxIds.includes(row.id) &&
          VOUCHER_ELIGIBLE_STATUSES.includes(row.voucher_status || 'not_create')
      ),
    [fuelSettlementRows, selectedTxIds]
  );

  const selectedFinanceDeclineTarget = useMemo(() => {
    const selected = fuelSettlementRows.filter((row) => selectedTxIds.includes(row.id));
    if (!selected.length) return null;

    const declineRows = selected.filter((row) =>
      FINANCE_DECLINE_ELIGIBLE_STATUSES.includes(row.voucher_status || 'not_create')
    );
    if (!declineRows.length || declineRows.length !== selected.length) return null;

    const voucherIds = [...new Set(declineRows.map((row) => row.voucher_id).filter(Boolean))];
    if (voucherIds.length > 1) return null;

    const first = declineRows[0];
    return {
      voucher_id: voucherIds[0] || null,
      voucher_no: first.voucher_no || null,
      voucher_status: first.voucher_status || 'not_create',
      transaction_ids: declineRows.map((row) => row.id),
      transaction_count: declineRows.length,
      total_amount: declineRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    };
  }, [fuelSettlementRows, selectedTxIds]);

  const approvedUnsettledVouchers = useMemo(
    () => activeVoucherHistory.filter((v) => v.status === 'approved' && Number(v.settled) !== 1),
    [activeVoucherHistory]
  );

  const toSettleCount = useMemo(() => fuelSettlementRows.length, [fuelSettlementRows]);

  const voucherHistoryActionCount = useMemo(
    () => activeVoucherHistory.filter((v) => v.status === 'pending').length,
    [activeVoucherHistory]
  );

  const pendingPhysicalApprovalCount = useMemo(
    () => activeVoucherHistory.filter((v) => v.status === 'pending').length,
    [activeVoucherHistory]
  );

  const countVoucherHistoryActions = (history = []) =>
    history.filter((v) => v.status === 'pending').length;

  const vehicleFuelTypeCount = useMemo(
    () => vehicleFuelSettlementRows.length + countVoucherHistoryActions(voucherHistory),
    [vehicleFuelSettlementRows, voucherHistory]
  );

  const generatorFuelTypeCount = useMemo(
    () => generatorFuelSettlementRows.length + countVoucherHistoryActions(generatorVoucherHistory),
    [generatorFuelSettlementRows, generatorVoucherHistory]
  );

  const allApprovedUnsettledVouchers = useMemo(
    () => [
      ...(voucherHistory || []).filter((v) => v.status === 'approved' && Number(v.settled) !== 1),
      ...(generatorVoucherHistory || []).filter((v) => v.status === 'approved' && Number(v.settled) !== 1),
    ],
    [voucherHistory, generatorVoucherHistory]
  );

  const settlementsTabBadgeCount = useMemo(() => {
    let count = 0;

    const cardsNeedingVoucher = new Set();
    vehicleFuelSettlementRows.forEach((row) => {
      if (VOUCHER_ELIGIBLE_STATUSES.includes(row.voucher_status || 'not_create')) {
        cardsNeedingVoucher.add(`v-${row.card_id}`);
      }
    });
    generatorFuelSettlementRows.forEach((row) => {
      if (VOUCHER_ELIGIBLE_STATUSES.includes(row.voucher_status || 'not_create')) {
        cardsNeedingVoucher.add(`g-${row.card_id}`);
      }
    });
    count += cardsNeedingVoucher.size;

    const pendingVoucherIds = new Set();
    [...vehicleFuelSettlementRows, ...generatorFuelSettlementRows].forEach((row) => {
      if (row.voucher_id && row.voucher_status === 'pending' && Number(row.settled) !== 1) {
        pendingVoucherIds.add(row.voucher_id);
      }
    });
    count += pendingVoucherIds.size;

    return count;
  }, [vehicleFuelSettlementRows, generatorFuelSettlementRows]);

  const mdUsers = useMemo(
    () =>
      users.filter((u) => String(u.job_role || '').trim().toLowerCase() === 'md' && Number(u.activated) !== 0),
    [users]
  );

  const createVoucherPreviewTotal = useMemo(
    () => selectedEligibleRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [selectedEligibleRows]
  );

  const createVoucherPreviewGroups = useMemo(() => {
    const map = new Map();
    selectedEligibleRows.forEach((row) => {
      const key = row.card_id;
      if (!map.has(key)) {
        map.set(key, {
          card_id: row.card_id,
          card_holder: row.card_holder,
          card_number: row.card_number,
          transactions: [],
          subtotal: 0,
        });
      }
      const group = map.get(key);
      group.transactions.push(row);
      group.subtotal += Number(row.amount) || 0;
    });
    return Array.from(map.values());
  }, [selectedEligibleRows]);

  const handleCreateVoucher = async () => {
    if (!hasCreateVoucherFeature) {
      toast.error('Access denied. Ask ICT to enable Create voucher under Auth Controls → Features.');
      return;
    }
    if (!selectedEligibleRows.length) return;
    try {
      const createFn =
        fuelSettlementSource === 'generator' ? createGeneratorFuelVoucher : createFuelVoucher;
      const result = await createFn({
        transaction_ids: selectedEligibleRows.map((row) => row.id),
      }).unwrap();
      setShowCreateVoucherModal(false);
      setSelectedTxIds([]);
      setPrintVoucher(result);
      refetchSettlements();
      if (fuelSettlementSource === 'generator') {
        refetchGeneratorVoucherHistory();
      } else {
        refetchVoucherHistory();
      }
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Failed to create voucher');
    }
  };

  const handleFinanceDeclineVoucher = async () => {
    if (!selectedFinanceDeclineTarget?.transaction_ids?.length || !declineVoucherReason.trim()) return;
    try {
      const declineFn =
        fuelSettlementSource === 'generator'
          ? declineGeneratorFuelVoucherByFinance
          : declineFuelVoucherByFinance;
      await declineFn({
        transaction_ids: selectedFinanceDeclineTarget.transaction_ids,
        reason: declineVoucherReason.trim(),
      }).unwrap();
      setShowDeclineVoucherModal(false);
      setDeclineVoucherReason('');
      setSelectedTxIds([]);
      refetchSettlements();
      if (fuelSettlementSource === 'generator') {
        refetchGeneratorVoucherHistory();
      } else {
        refetchVoucherHistory();
      }
      toast.success('Declined');
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Failed to decline');
    }
  };

  const goToVoucherPayments = () => {
    navigate({ pathname: '/home/finance/voucher-payments', search: routerLocation.search });
  };

  const openSettlementProof = (url) => {
    if (!url) return;
    if (isPdfProofUrl(url)) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    setSettlementProofPreviewUrl(url);
  };

  const openVoucherPrint = (voucher) => {
    if (voucher?.lines?.length) {
      setPrintVoucher(voucher);
      return;
    }
    setDetailVoucherId(voucher.id);
  };

  const handlePhysicalApproval = async (e) => {
    e.preventDefault();
    if (!physicalApprovalVoucher?.id || !physicalApproverId) return;
    try {
      const imageDataUri = await fileToDataUri(physicalApprovalImage);
      const recordFn =
        fuelSettlementSource === 'generator'
          ? recordGeneratorPhysicalApproval
          : recordPhysicalApproval;
      await recordFn({
        id: physicalApprovalVoucher.id,
        approved_by: Number(physicalApproverId),
        physical_approval_image: imageDataUri,
      }).unwrap();
      setPhysicalApprovalVoucher(null);
      setPhysicalApproverId('');
      setPhysicalApprovalImage(null);
      refetchSettlements();
      if (fuelSettlementSource === 'generator') {
        refetchGeneratorVoucherHistory();
      } else {
        refetchVoucherHistory();
      }
      setLastRefreshedAt(new Date());
      toast.success('Physical approval recorded');
    } catch (error) {
      toast.error(error?.data?.message || error?.message || 'Failed to record physical approval');
    }
  };

  return (
    <div className="financial-cards-container">
      <div className="financial-cards-header">
        <h1>Financial Cards Management</h1>
        <div className="financial-cards-header-right">
          <div className="financial-cards-refresh-meta">
            <span className="financial-cards-refresh-label">Last updated</span>
            <span className="financial-cards-refresh-time">{formatRefreshClock(lastRefreshedAt)}</span>
            <button
              type="button"
              className="financial-cards-refresh-btn"
              onClick={() => void refreshAllFinancialCardsData()}
              disabled={isRefreshingFinancialCards}
              title="Refresh data now"
            >
              {isRefreshingFinancialCards ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          {activeTab === 'cards' ? (
            <button className="btn-primary-financial-cards" onClick={() => handleOpenCardModal()}>
              <FaPlus /> Add New Card
            </button>
          ) : null}
        </div>
      </div>

      <div className="financial-cards-tabs">
        <button
          type="button"
          className={`financial-cards-tab${activeTab === 'cards' ? ' active' : ''}`}
          onClick={() => setActiveTab('cards')}
        >
          Card View
        </button>
        <button
          type="button"
          className={`financial-cards-tab${activeTab === 'settlements' ? ' active' : ''}`}
          onClick={() => setActiveTab('settlements')}
        >
          Transactions to Settle
          {settlementsTabBadgeCount > 0 ? (
            <span className="financial-cards-tab-badge">{settlementsTabBadgeCount}</span>
          ) : null}
        </button>
      </div>

      {activeTab === 'cards' && (cardsLoading ? (
        <div className="loading-financial-cards">Loading cards...</div>
      ) : (
        <div className="cards-grid-financial-cards">
          {cards.map((card) => {
            const balance = parseFloat(card.amount || 0);
            // By default, use masked values from backend (card.no and card.cvc are already masked)
            // Only use decrypted values if security code was verified
            const hasDecryptedData = decryptedCards[card.id];
            let displayCardNo = hasDecryptedData ? decryptedCards[card.id].no : (card.no || 'N/A');
            const displayCvc = hasDecryptedData ? decryptedCards[card.id].cvc : (card.cvc || '***');
            
            // Format card number
            let formattedCardNo = 'N/A';
            if (displayCardNo && displayCardNo !== 'N/A') {
              if (hasDecryptedData) {
                // Decrypted value - format with spaces every 4 digits
                formattedCardNo = displayCardNo.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
              } else {
                // Masked value from backend - use as is (should already be formatted like "**** **** **** 1234")
                formattedCardNo = displayCardNo.includes('*') ? displayCardNo : '**** **** **** ' + displayCardNo.slice(-4);
              }
            }
            
            const expDate = card.exp_date ? new Date(card.exp_date).toLocaleDateString('en-US', { month: '2-digit', year: '2-digit' }) : 'N/A';
            const isFlipped = flippedCardId === card.id;
            return (
              <div key={card.id} className="card-item-financial-cards">
                <div 
                  className={`bank-card-container-financial-cards ${isFlipped ? 'flipped-financial-cards' : ''}`}
                  onClick={(e) => {
                    // Don't flip if clicking on buttons or chip
                    if (!e.target.closest('.bank-card-actions-financial-cards') && 
                        !e.target.closest('.bank-card-chip-financial-cards')) {
                      setFlippedCardId(isFlipped ? null : card.id);
                    }
                  }}
                >
                  <div className="bank-card-inner-financial-cards">
                    {/* Front Side */}
                    <div className="bank-card-front-financial-cards">
                  <div className="bank-card-header-financial-cards">
                    <div 
                      className="bank-card-chip-financial-cards"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewCardDetails(card);
                      }}
                      title="View Card Details"
                    >
                      <div className="chip-financial-cards"></div>
                    </div>
                    <div className="bank-card-actions-financial-cards" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="btn-card-icon-financial-cards btn-card-topup-financial-cards"
                            onClick={() => handleOpenTransactionModal(card, 'add')}
                            title="Topup Card"
                          >
                            <FaArrowUp />
                          </button>
                          {(() => {
                            const cardSettlement = pendingSettlements.find(
                              (s) => Number(s.card_id) === Number(card.id)
                            );
                            const pendingCount = (cardSettlement?.transactions || []).filter(
                              (t) => t.voucher_status !== 'finance_declined'
                            ).length;
                            const hasPending = pendingCount > 0;
                            return (
                              <button
                                className={`btn-card-icon-financial-cards btn-card-pending-financial-cards${hasPending ? ' has-pending-financial-cards' : ''}`}
                                onClick={() => setPendingViewCard(card)}
                                title={hasPending
                                  ? `View ${pendingCount} pending settlement${pendingCount === 1 ? '' : 's'}`
                                  : 'View pending settlements'}
                              >
                                <FaEye />
                                {hasPending ? (
                                  <span className="btn-card-settle-badge-financial-cards">{pendingCount}</span>
                                ) : null}
                              </button>
                            );
                          })()}
                          <button
                            className="btn-card-icon-financial-cards btn-card-history-financial-cards"
                            onClick={() => handleViewCardDetails(card)}
                            title="View History"
                          >
                            <FaHistory />
                          </button>
                          <button
                            className="btn-card-icon-financial-cards"
                            onClick={() => handleOpenCardModal(card)}
                            title="Edit Card"
                          >
                            <FaEdit />
                          </button>
                          <button
                            className="btn-card-icon-financial-cards btn-card-danger-financial-cards"
                            onClick={() => handleDeleteCard(card.id)}
                            title="Deactivate Card"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </div>
                      <div className="bank-card-number-financial-cards">
                        {formattedCardNo}
                      </div>
                      <div className="bank-card-details-financial-cards">
                        <div className="bank-card-holder-financial-cards">
                          <div className="bank-card-label-financial-cards">CARD HOLDER</div>
                          <div className="bank-card-value-financial-cards">{card.card_holder || 'N/A'}</div>
                        </div>
                        <div className="bank-card-expiry-financial-cards">
                          <div className="bank-card-label-financial-cards">EXPIRES</div>
                          <div className="bank-card-value-financial-cards">{expDate}</div>
                        </div>
                      </div>
                      <div className="bank-card-footer-financial-cards">
                        <div className="bank-card-bank-financial-cards">{card.bank_name || 'BANK'}</div>
                        <div className={`bank-card-balance-financial-cards ${balance >= 0 ? 'positive-financial-cards' : 'negative-financial-cards'}`}>
                          LKR {balance.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    
                    {/* Back Side */}
                    <div className="bank-card-back-financial-cards">
                      <div className="bank-card-back-stripe-financial-cards"></div>
                      <div className="bank-card-back-cvc-financial-cards">
                        <div className="bank-card-back-label-financial-cards">CVC</div>
                        <div className="bank-card-back-cvc-value-financial-cards">{displayCvc}</div>
                      </div>
                      <div className="bank-card-back-footer-financial-cards">
                        <div className="bank-card-back-signature-financial-cards">
                          <div className="bank-card-back-signature-label-financial-cards">AUTHORIZED SIGNATURE</div>
                          <div className="bank-card-back-signature-box-financial-cards"></div>
                        </div>
                        <div className="bank-card-back-bank-financial-cards">{card.bank_name || 'BANK'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {activeTab === 'settlements' ? (
        <div className="pending-settlements-section-financial-cards">
          <div className="settlements-header-financial-cards">
            <h2 className="settlements-title-financial-cards">
              <span className="settlements-icon-financial-cards">
                <FaFileInvoice />
              </span>
              Fuel Settlements
            </h2>
            <div className="settlements-filters-financial-cards">
              <div className="settlement-search-wrap-financial-cards">
                <FaSearch className="settlement-search-icon-financial-cards" aria-hidden="true" />
                <input
                  type="text"
                  placeholder={
                    settlementsSubTab === 'voucher-history'
                      ? 'Search voucher no, amount...'
                      : 'Search driver, card, voucher...'
                  }
                  value={settlementSearch}
                  onChange={(e) => setSettlementSearch(e.target.value)}
                  className="settlement-search-input-financial-cards"
                />
              </div>
              {settlementsSubTab === 'voucher-history' ? (
                <>
                  <select
                    value={settlementMonth}
                    onChange={(e) => setSettlementMonth(e.target.value)}
                    className="settlement-filter-select-financial-cards"
                    aria-label="Filter by month"
                    title="Voucher created month"
                  >
                    <option value="">All months</option>
                    {settlementMonthOptions.map((key) => (
                      <option key={key} value={key}>{formatMonthLabel(key)}</option>
                    ))}
                  </select>
                  <select
                    value={settlementVoucherStatus}
                    onChange={(e) => setSettlementVoucherStatus(e.target.value)}
                    className="settlement-filter-select-financial-cards"
                    aria-label="Filter by voucher status"
                  >
                    <option value="all">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="declined">Declined</option>
                  </select>
                </>
              ) : null}
            </div>
            <div className="settlements-header-actions-financial-cards">
              {hasCreateVoucherFeature ? (
                <button
                  type="button"
                  className="btn-primary-financial-cards settlements-compact-btn-financial-cards"
                  disabled={!selectedEligibleRows.length || isCreatingVoucher}
                  onClick={() => setShowCreateVoucherModal(true)}
                  title="Create voucher from selected transactions"
                >
                  <FaPlus aria-hidden="true" />
                  {isCreatingVoucher ? 'Creating...' : `Voucher (${selectedEligibleRows.length})`}
                </button>
              ) : null}
              <button
                type="button"
                className="btn-primary-financial-cards settlements-compact-btn-financial-cards"
                onClick={goToVoucherPayments}
                title="Voucher Payments: approved vouchers waiting for payment"
              >
                <FaReceipt aria-hidden="true" />
                Payments
                {allApprovedUnsettledVouchers.length > 0 ? (
                  <span className="settlements-compact-btn-badge-financial-cards">
                    {allApprovedUnsettledVouchers.length}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                className="btn-decline-voucher-financial-cards settlements-compact-btn-financial-cards"
                disabled={!selectedFinanceDeclineTarget || isDecliningFinanceVoucher}
                onClick={() => {
                  setDeclineVoucherReason('');
                  setShowDeclineVoucherModal(true);
                }}
                title="Decline selected transactions"
              >
                <FaBan aria-hidden="true" />
                {isDecliningFinanceVoucher ? 'Declining...' : 'Decline'}
              </button>
            </div>
          </div>

          <div className="settlements-tab-nav-financial-cards">
            <div className="settlements-tab-group-financial-cards">
              <span className="settlements-tab-group-label-financial-cards">Fuel type</span>
              <div className="settlements-tab-pills-financial-cards">
                <button
                  type="button"
                  className={`settlements-tab-pill-financial-cards${fuelSettlementSource === 'vehicle' ? ' active' : ''}`}
                  onClick={() => {
                    setFuelSettlementSource('vehicle');
                    setSelectedTxIds([]);
                  }}
                >
                  Vehicle Fuel
                  {vehicleFuelTypeCount > 0 ? (
                    <span className="settlements-tab-pill-badge-financial-cards">{vehicleFuelTypeCount}</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className={`settlements-tab-pill-financial-cards${fuelSettlementSource === 'generator' ? ' active' : ''}`}
                  onClick={() => {
                    setFuelSettlementSource('generator');
                    setSelectedTxIds([]);
                  }}
                >
                  Generator Fuel
                  {generatorFuelTypeCount > 0 ? (
                    <span className="settlements-tab-pill-badge-financial-cards">{generatorFuelTypeCount}</span>
                  ) : null}
                </button>
              </div>
            </div>
            <div className="settlements-tab-group-financial-cards">
              <span className="settlements-tab-group-label-financial-cards">View</span>
              <div className="settlements-tab-pills-financial-cards">
                <button
                  type="button"
                  className={`settlements-tab-pill-financial-cards${settlementsSubTab === 'pending' ? ' active' : ''}`}
                  onClick={() => {
                    setSettlementsSubTab('pending');
                    setSettlementSearch('');
                    setSettlementMonth('');
                    setSettlementVoucherStatus('all');
                    setSelectedTxIds([]);
                  }}
                >
                  To Settle
                  {toSettleCount > 0 ? (
                    <span className="settlements-tab-pill-badge-financial-cards">{toSettleCount}</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className={`settlements-tab-pill-financial-cards${settlementsSubTab === 'voucher-history' ? ' active' : ''}`}
                  onClick={() => {
                    setSettlementsSubTab('voucher-history');
                    setSettlementSearch('');
                    setSettlementMonth('');
                    setSettlementVoucherStatus('all');
                    setSelectedTxIds([]);
                  }}
                >
                  Voucher History
                  {voucherHistoryActionCount > 0 ? (
                    <span className="settlements-tab-pill-badge-financial-cards">{voucherHistoryActionCount}</span>
                  ) : null}
                </button>
              </div>
            </div>
          </div>

          {settlementsSubTab === 'pending' ? (
            groupedFuelRows.length === 0 ? (
              <div className="no-settlements-financial-cards">
                <p>No admin-approved fuel transactions pending settlement</p>
              </div>
            ) : (
              <>
                {selectedTxIds.length > 0 ? (
                  <div className="settlement-selection-bar-financial-cards">
                    <span>
                      {selectedTxIds.length} transaction{selectedTxIds.length === 1 ? '' : 's'} selected
                      {selectedEligibleRows.length > 0
                        ? ` · ${selectedEligibleRows.length} eligible for voucher`
                        : ''}
                      {selectedFinanceDeclineTarget
                        ? ` · ${selectedFinanceDeclineTarget.transaction_count} can be declined`
                        : ''}
                    </span>
                    <button
                      type="button"
                      className="settlement-selection-clear-financial-cards"
                      onClick={() => setSelectedTxIds([])}
                    >
                      Clear selection
                    </button>
                  </div>
                ) : null}
                <div className="settlements-table-container-financial-cards">
                  <table className="settlements-table-financial-cards">
                    <thead>
                      <tr>
                        <th className="settlement-checkbox-col-financial-cards">
                          <SettlementCheckbox
                            checked={visibleAllSelected}
                            indeterminate={visibleSomeSelected}
                            onChange={() => toggleSelectAllVisible(visibleTxIds)}
                            ariaLabel="Select all visible transactions"
                          />
                        </th>
                        <th>Date</th>
                        <th>Images</th>
                        <th>Amount</th>
                        <th>Fuel Details</th>
                        <th>Admin Approver</th>
                        <th>Voucher Status</th>
                        <th>Voucher No</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedFuelRows.map((group) => {
                        const groupIds = group.transactions.map((t) => t.id);
                        const selectedInGroup = groupIds.filter((id) => selectedTxIds.includes(id)).length;
                        const groupAllSelected =
                          groupIds.length > 0 && groupIds.every((id) => selectedTxIds.includes(id));
                        const groupSomeSelected = selectedInGroup > 0 && !groupAllSelected;
                        return (
                          <React.Fragment key={group.card_id}>
                            <tr className="fuel-group-header-row-financial-cards">
                              <td className="settlement-checkbox-col-financial-cards">
                                <SettlementCheckbox
                                  checked={groupAllSelected}
                                  indeterminate={groupSomeSelected}
                                  onChange={() => toggleGroupSelection(groupIds)}
                                  ariaLabel={`Select all for ${groupDriverLabel(group.transactions)}`}
                                />
                              </td>
                              <td colSpan={7}>
                                <div className="fuel-group-header-content-financial-cards">
                                  <span className="fuel-group-holder-financial-cards">
                                    {groupDriverLabel(group.transactions)}
                                  </span>
                                  <span className="fuel-group-meta-financial-cards">
                                    {group.card_number || 'N/A'}
                                  </span>
                                  <span className="fuel-group-meta-financial-cards">
                                    {group.transactions.length} transaction
                                    {group.transactions.length === 1 ? '' : 's'}
                                  </span>
                                  {selectedInGroup > 0 ? (
                                    <span className="fuel-group-selected-financial-cards">
                                      {selectedInGroup} selected
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                            {group.transactions.map((transaction) => (
                              <tr
                                key={transaction.id}
                                className={`fuel-group-tx-row-financial-cards${
                                  selectedTxIds.includes(transaction.id) ? ' is-selected-financial-cards' : ''
                                }`}
                              >
                                <td className="settlement-checkbox-col-financial-cards">
                                  <SettlementCheckbox
                                    checked={selectedTxIds.includes(transaction.id)}
                                    onChange={() => toggleGlobalSelection(transaction.id)}
                                    ariaLabel={`Select transaction for ${groupDriverLabel(group.transactions)}`}
                                  />
                                </td>
                                <td>{new Date(transaction.date).toLocaleDateString()}</td>
                                <td className="fuel-settlement-images-cell-financial-cards">
                                  <div className="fuel-settlement-image-actions-financial-cards">
                                    <button
                                      type="button"
                                      className="fuel-settlement-image-btn-financial-cards"
                                      disabled={!transaction.bill_image_url}
                                      onClick={() => openSettlementProof(transaction.bill_image_url)}
                                    >
                                      Bill
                                    </button>
                                    <button
                                      type="button"
                                      className="fuel-settlement-image-btn-financial-cards"
                                      disabled={!transaction.bank_slip_image_url}
                                      onClick={() => openSettlementProof(transaction.bank_slip_image_url)}
                                    >
                                      Slip
                                    </button>
                                  </div>
                                </td>
                                <td className="amount-cell-financial-cards">
                                  LKR {parseFloat(transaction.amount || 0).toFixed(2)}
                                </td>
                                <td className="fuel-details-cell-financial-cards">
                                  {formatFuelVoucherDescription(transaction)}
                                </td>
                                <td>{transaction.approved_by_name || 'N/A'}</td>
                                <td>
                                  <span
                                    className={`voucher-status-pill-financial-cards ${
                                      transaction.voucher_status || 'not_create'
                                    }`}
                                  >
                                    {voucherStatusLabel(transaction.voucher_status)}
                                  </span>
                                </td>
                                <td>{transaction.voucher_no || '-'}</td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )
          ) : (
            <div className="settlements-table-container-financial-cards">
              {pendingPhysicalApprovalCount > 0 ? (
                <div className="settlements-action-summary-financial-cards">
                  {pendingPhysicalApprovalCount} voucher{pendingPhysicalApprovalCount === 1 ? '' : 's'} awaiting physical approval
                </div>
              ) : null}
              <div className="settlements-approved-note-financial-cards">
                Approved vouchers move to{' '}
                <button type="button" className="settlements-link-btn-financial-cards" onClick={goToVoucherPayments}>
                  Voucher Payments
                </button>
                {approvedUnsettledVouchers.length > 0
                  ? ` · ${approvedUnsettledVouchers.length} awaiting payment`
                  : ''}
              </div>
              <table className="voucher-history-table-financial-cards">
                <thead>
                  <tr>
                    <th>Voucher No</th>
                    <th>Created</th>
                    <th>Status</th>
                    <th>Approved / Declined By</th>
                    <th>Details</th>
                    <th>Amount</th>
                    <th>Settled</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {voucherHistoryRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                        No {fuelSettlementSource === 'generator' ? 'generator' : 'transport'} vouchers
                        {settlementMonth ? ' for this month' : ' yet'}
                      </td>
                    </tr>
                  ) : (
                    voucherHistoryRows.map((voucher) => (
                      <tr key={voucher.id}>
                        <td>{voucher.voucher_no}</td>
                        <td>{new Date(voucher.created_at).toLocaleDateString()}</td>
                        <td>
                          <span className={`voucher-status-pill-financial-cards ${voucher.status}`}>
                            {voucherStatusLabel(voucher.status)}
                          </span>
                        </td>
                        <td>{getVoucherDecidedBy(voucher)}</td>
                        <td className="voucher-details-cell-financial-cards">
                          <div className="voucher-details-main-financial-cards">
                            {getVoucherApprovalTypeLabel(voucher)} ({voucher.transaction_count || 0})
                          </div>
                          <div className="voucher-details-sub-financial-cards">
                            {voucher.transaction_count || 0} transaction
                            {(voucher.transaction_count || 0) === 1 ? '' : 's'}
                          </div>
                        </td>
                        <td>LKR {Number(voucher.total_amount || 0).toFixed(2)}</td>
                        <td className="voucher-settled-cell-financial-cards">
                          {Number(voucher.settled) === 1 ? (
                            voucher.settlement_proof_image_url ? (
                              isPdfProofUrl(voucher.settlement_proof_image_url) ? (
                                <button
                                  type="button"
                                  className="voucher-settlement-proof-link-financial-cards"
                                  onClick={() => openSettlementProof(voucher.settlement_proof_image_url)}
                                >
                                  View proof
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="voucher-settlement-proof-thumb-btn-financial-cards"
                                  onClick={() => openSettlementProof(voucher.settlement_proof_image_url)}
                                  title="View settlement proof"
                                  aria-label="View settlement proof"
                                >
                                  <img
                                    src={voucher.settlement_proof_image_url}
                                    alt="Settlement proof"
                                    className="voucher-settlement-proof-thumb-financial-cards"
                                  />
                                </button>
                              )
                            ) : (
                              <span className="voucher-settled-label-financial-cards">Settled</span>
                            )
                          ) : (
                            <span className="voucher-not-settled-financial-cards">Not settled</span>
                          )}
                        </td>
                        <td className="voucher-history-actions-cell-financial-cards">
                          <div className="voucher-history-actions-financial-cards">
                            <button
                              type="button"
                              className="voucher-action-btn-financial-cards voucher-action-btn-outline-financial-cards"
                              onClick={() => openVoucherPrint(voucher)}
                              title="Print"
                              aria-label="Print voucher"
                            >
                              <FaPrint />
                            </button>
                            {voucher.status === 'pending' ? (
                              <button
                                type="button"
                                className={`voucher-physical-approval-btn-financial-cards${
                                  isRecordingPhysicalApproval && physicalApprovalVoucher?.id === voucher.id
                                    ? ' is-loading'
                                    : ''
                                }`}
                                disabled={isRecordingPhysicalApproval}
                                onClick={() => {
                                  setPhysicalApprovalVoucher(voucher);
                                  setPhysicalApproverId('');
                                  setPhysicalApprovalImage(null);
                                }}
                                title="Upload physical approval"
                                aria-label="Upload physical approval"
                              >
                                {isRecordingPhysicalApproval && physicalApprovalVoucher?.id === voucher.id ? (
                                  <>
                                    <span className="financial-cards-btn-spinner" aria-hidden="true" />
                                    Saving…
                                  </>
                                ) : (
                                  <>
                                    <FaUpload />
                                    Physical Approval
                                  </>
                                )}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {/* Card Modal */}
      {showCardModal && (
        <div className="modal-overlay-financial-cards" onClick={handleCloseCardModal}>
          <div className="modal-content-financial-cards" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-financial-cards">
              <h2>{editingCard ? 'Edit Card' : 'Add New Card'}</h2>
              <button className="modal-close-financial-cards" onClick={handleCloseCardModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmitCard} className="modal-form-financial-cards" autoComplete="off" noValidate>
              <div className="form-group-financial-cards">
                <label>Card Number</label>
                {editingCard ? (
                  <>
                    <input
                      type="text"
                      readOnly
                      className="card-number-readonly-financial-cards"
                      value={editingCard.no_masked || editingCard.no || 'N/A'}
                      aria-label="Card number (masked, cannot be edited)"
                      autoComplete="off"
                    />
                    <small
                      style={{
                        color: '#6c757d',
                        fontSize: '0.85rem',
                        display: 'block',
                        marginTop: '6px',
                      }}
                    >
                      Card number cannot be changed. Enter a new CVC below if needed.
                    </small>
                  </>
                ) : (
                  <>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={cardFormData.no}
                      onChange={(e) => {
                        let value = e.target.value.replace(/\D/g, '');
                        value = value.match(/.{1,4}/g)?.join(' ') || value;
                        setCardFormData({ ...cardFormData, no: value });
                      }}
                      placeholder="1234 5678 9012 3456"
                      maxLength={23}
                      autoComplete="off"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck="false"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-form-type="other"
                      name="card-no-input"
                      id="card-no-input"
                    />
                    {cardFormData.no && cardFormData.no.replace(/\s/g, '').length > 0 &&
                      cardFormData.no.replace(/\s/g, '').length < 13 && (
                        <small
                          style={{
                            color: '#dc3545',
                            fontSize: '0.85rem',
                            display: 'block',
                            marginTop: '4px',
                          }}
                        >
                          Card number must be 13-19 digits
                        </small>
                      )}
                  </>
                )}
              </div>
              <div className="form-group-financial-cards">
                <label>CVC</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={cardFormData.cvc}
                  onChange={(e) => {
                    // Allow only digits, max 4 characters
                    let value = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setCardFormData({ ...cardFormData, cvc: value });
                  }}
                  placeholder="123"
                  maxLength={4}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                  name="cvc-field"
                  id="cvc-field"
                />
                {cardFormData.cvc && cardFormData.cvc.length > 0 && 
                 cardFormData.cvc.length < 3 && (
                  <small style={{ color: '#dc3545', fontSize: '0.85rem', display: 'block', marginTop: '4px' }}>
                    CVC must be 3 or 4 digits
                  </small>
                )}
              </div>
              <div className="form-group-financial-cards">
                <label>Card Holder</label>
                <input
                  type="text"
                  value={cardFormData.card_holder}
                  onChange={(e) => setCardFormData({ ...cardFormData, card_holder: e.target.value })}
                  placeholder="Enter card holder name"
                />
              </div>
              <div className="form-group-financial-cards">
                <label>Expiry Date</label>
                <input
                  type="date"
                  value={cardFormData.exp_date}
                  onChange={(e) => setCardFormData({ ...cardFormData, exp_date: e.target.value })}
                />
              </div>
              <div className="form-group-financial-cards">
                <label>Category</label>
                <select
                  value={cardFormData.category}
                  onChange={(e) =>
                    setCardFormData({ ...cardFormData, category: e.target.value, vehicle_id: '', sub_category: '', user: '' })
                  }
                >
                  <option value="">-- Select Category --</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.category_name}
                    </option>
                  ))}
                </select>
              </div>
              {String(cardFormData.category) === '1' && (
                <div className="form-group-financial-cards">
                  <label>Sub Category</label>
                  <select
                    value={cardFormData.sub_category}
                    onChange={(e) =>
                      setCardFormData({
                        ...cardFormData,
                        sub_category: e.target.value,
                        vehicle_id: '',
                        user: '',
                      })
                    }
                  >
                    <option value="">-- Select Sub Category --</option>
                    {fuelSubCategories.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.type}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {String(cardFormData.category) !== '1' && (
                <div className="form-group-financial-cards">
                  <label>Card User</label>
                  <select
                    value={cardFormData.user}
                    onChange={(e) => setCardFormData({ ...cardFormData, user: e.target.value })}
                  >
                    <option value="">-- Select User --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.user_name || u.email || `User #${u.id}`}
                        {u.mobile_no ? ` (${u.mobile_no})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {String(cardFormData.category) === '1' && selectedFuelSubType === 'vehicle' && (
                <div className="form-group-financial-cards">
                  <label>Vehicle (Own)</label>
                  <select
                    value={cardFormData.vehicle_id}
                    onChange={(e) =>
                      setCardFormData({
                        ...cardFormData,
                        vehicle_id: e.target.value,
                      })
                    }
                  >
                    <option value="">-- Select vehicle --</option>
                    {ownVehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vehicle_no}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {String(cardFormData.category) === '1' && selectedFuelSubType === 'generator' && (
                <div className="form-group-financial-cards">
                  <label>Pilot User</label>
                  <select
                    value={cardFormData.user}
                    onChange={(e) =>
                      setCardFormData({
                        ...cardFormData,
                        user: e.target.value,
                        vehicle_id: '',
                      })
                    }
                  >
                    <option value="">-- Select pilot user --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.user_name || u.email || `User #${u.id}`}
                        {u.mobile_no ? ` (${u.mobile_no})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group-financial-cards">
                <label>Bank</label>
                <select
                  value={cardFormData.bank_id}
                  onChange={(e) => setCardFormData({ ...cardFormData, bank_id: e.target.value })}
                >
                  <option value="">-- Select Bank --</option>
                  {banks.map((bank) => (
                    <option key={bank.id} value={bank.id}>
                      {bank.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group-financial-cards">
                <label>Limitation</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={formatThousandsDisplay(sanitizeAmountInput(cardFormData.limitation))}
                  onChange={(e) =>
                    setCardFormData({
                      ...cardFormData,
                      limitation: sanitizeAmountInput(e.target.value),
                    })
                  }
                  placeholder="500,000"
                />
              </div>
              <div className="form-group-financial-cards">
                <label>Amount (Initial Balance)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={formatThousandsDisplay(sanitizeAmountInput(cardFormData.amount))}
                  onChange={(e) =>
                    setCardFormData({
                      ...cardFormData,
                      amount: sanitizeAmountInput(e.target.value),
                    })
                  }
                  placeholder="100,000"
                />
              </div>
              <div className="modal-actions-financial-cards">
                <button type="button" className="btn-cancel-financial-cards" onClick={handleCloseCardModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit-financial-cards" disabled={creatingCard || updatingCard}>
                  {creatingCard || updatingCard ? 'Saving...' : editingCard ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {showTransactionModal && selectedCard && (
        <div className="modal-overlay-financial-cards" onClick={handleCloseTransactionModal}>
          <div className="modal-content-financial-cards" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-financial-cards">
              <h2>{transactionType === 'add' ? 'Topup Card' : 'Spend from Card'}</h2>
              <button className="modal-close-financial-cards" onClick={handleCloseTransactionModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmitTransaction} className="modal-form-financial-cards">
              <div className="form-group-financial-cards">
                <label>Card</label>
                <input type="text" value={selectedCard.no || 'N/A'} disabled />
              </div>
              <div className="form-group-financial-cards">
                <label>Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={transactionFormData.amount}
                  onChange={(e) => setTransactionFormData({ ...transactionFormData, amount: e.target.value })}
                  placeholder="Enter amount"
                  required
                />
              </div>
              <div className="form-group-financial-cards">
                <label>Transaction Slip No (Description)</label>
                <input
                  type="text"
                  value={transactionFormData.description}
                  onChange={(e) => setTransactionFormData({ ...transactionFormData, description: e.target.value })}
                  placeholder="Enter transaction slip number"
                  required
                />
              </div>
              <div className="form-group-financial-cards">
                <label>Image (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setTransactionFormData({ ...transactionFormData, image: e.target.files[0] })}
                />
              </div>
              <div className="modal-actions-financial-cards">
                <button type="button" className="btn-cancel-financial-cards" onClick={handleCloseTransactionModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit-financial-cards" disabled={creatingTransaction}>
                  {creatingTransaction ? 'Processing...' : transactionType === 'add' ? 'Topup' : 'Spend'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Security Code Modal - Compact & Modern */}
      {showSecurityCodeModal && selectedCard && (
        <div className="modal-overlay-financial-cards security-code-overlay-financial-cards" onClick={() => { setShowSecurityCodeModal(false); setSecurityCode(''); setSecurityCodeError(''); }}>
          <div className="security-code-modal-financial-cards" onClick={(e) => e.stopPropagation()}>
            <div className="security-code-header-financial-cards">
              <div className="security-code-icon-financial-cards">🔒</div>
              <h3>Security Code</h3>
              <button className="security-code-close-financial-cards" onClick={() => { setShowSecurityCodeModal(false); setSecurityCode(''); setSecurityCodeError(''); }}>
                ×
              </button>
            </div>
            <div className="security-code-body-financial-cards">
              <p className="security-code-hint-financial-cards">Enter 4-digit code</p>
              <div className="security-code-input-wrapper-financial-cards">
                <input
                  type="password"
                  inputMode="numeric"
                  value={securityCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setSecurityCode(value);
                    // Clear error when user starts typing
                    if (securityCodeError) {
                      setSecurityCodeError('');
                    }
                  }}
                  placeholder="••••"
                  maxLength={4}
                  autoComplete="off"
                  autoFocus
                  className={`security-code-input-financial-cards ${securityCodeError ? 'error-financial-cards' : ''}`}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && securityCode.length === 4) {
                      handleVerifySecurityCode();
                    }
                  }}
                />
                {securityCodeError && (
                  <div className="security-code-error-financial-cards">
                    {securityCodeError}
                  </div>
                )}
              </div>
              <button
                className="security-code-verify-btn-financial-cards"
                onClick={handleVerifySecurityCode}
                disabled={securityCode.length !== 4}
              >
                Verify
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Card Details Modal */}
      {showCardDetails && selectedCard && (
        <div className="modal-overlay-financial-cards" onClick={handleCloseCardDetails}>
          <div className="modal-content-financial-cards modal-large-financial-cards" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-financial-cards">
              <h2>Card Details & Transaction History</h2>
              <button className="modal-close-financial-cards" onClick={handleCloseCardDetails}>
                ×
              </button>
            </div>
            <div className="card-details-financial-cards">
              <div className="card-details-info-financial-cards">
                <h3>Card Information</h3>
                <div className="details-grid-financial-cards">
                  <div className="detail-item-financial-cards">
                    <label>Card Number:</label>
                    <span>{selectedCard.no ? selectedCard.no.replace(/(.{4})/g, '$1 ').trim() : 'N/A'}</span>
                  </div>
                  <div className="detail-item-financial-cards">
                    <label>CVC:</label>
                    <span>{selectedCard.cvc || '***'}</span>
                  </div>
                  <div className="detail-item-financial-cards">
                    <label>Card Holder:</label>
                    <span>{selectedCard.card_holder || 'N/A'}</span>
                  </div>
                  <div className="detail-item-financial-cards">
                    <label>User:</label>
                    <span>{selectedCard.user_name || selectedCard.user_email || 'Not Assigned'}</span>
                  </div>
                  <div className="detail-item-financial-cards">
                    <label>Category:</label>
                    <span>{selectedCard.category_name || selectedCard.category || 'N/A'}</span>
                  </div>
                  {Number(selectedCard.category) === 1 && (
                    <div className="detail-item-financial-cards">
                      <label>Vehicle (Own):</label>
                      <span>
                        {selectedCard.vehicle_no
                          ? selectedCard.vehicle_no
                          : selectedCard.vehicle_id
                            ? `Vehicle #${selectedCard.vehicle_id}`
                            : 'Not assigned'}
                      </span>
                    </div>
                  )}
                  <div className="detail-item-financial-cards">
                    <label>Bank:</label>
                    <span>{selectedCard.bank_name || 'N/A'}</span>
                  </div>
                  <div className="detail-item-financial-cards">
                    <label>Balance:</label>
                    <span className={`balance-financial-cards ${parseFloat(selectedCard.amount || 0) >= 0 ? 'positive-financial-cards' : 'negative-financial-cards'}`}>
                      {parseFloat(selectedCard.amount || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="detail-item-financial-cards">
                    <label>Limit:</label>
                    <span>{parseFloat(selectedCard.limitation || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <div className="card-transactions-financial-cards">
                <h3>Transaction History</h3>
                <div className="transactions-table-financial-cards">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="no-transactions-financial-cards">
                            No transactions found
                          </td>
                        </tr>
                      ) : (
                        transactions.map((transaction) => {
                          // Format date
                          let formattedDate = 'N/A';
                          if (transaction.date) {
                            try {
                              const date = new Date(transaction.date);
                              formattedDate = date.toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: '2-digit', 
                                day: '2-digit' 
                              });
                            } catch (e) {
                              formattedDate = transaction.date;
                            }
                          }
                          
                          // Format time
                          let formattedTime = 'N/A';
                          try {
                            if (transaction.time) {
                              const timeStr = transaction.time.includes('T') 
                                ? transaction.time.split('T')[1]?.split('.')[0] || transaction.time
                                : transaction.time;
                              const [hours, minutes] = timeStr.split(':');
                              const timeDate = new Date(2000, 0, 1, parseInt(hours) || 0, parseInt(minutes) || 0);
                              formattedTime = timeDate.toLocaleTimeString('en-US', { 
                                hour: '2-digit', 
                                minute: '2-digit',
                                hour12: true 
                              });
                            } else if (transaction.date) {
                              const date = new Date(transaction.date);
                              formattedTime = date.toLocaleTimeString('en-US', { 
                                hour: '2-digit', 
                                minute: '2-digit',
                                hour12: true 
                              });
                            }
                          } catch (e) {
                            formattedTime = transaction.time || 'N/A';
                          }
                          
                          return (
                            <tr key={transaction.id}>
                              <td>{formattedDate}</td>
                              <td>{formattedTime}</td>
                              <td>
                                <span className={`transaction-type-financial-cards ${transaction.type}`}>
                                  {transaction.type === 'add' ? 'Topup' : 'Spend'}
                                </span>
                              </td>
                              <td className={transaction.type === 'add' ? 'amount-positive-financial-cards' : 'amount-negative-financial-cards'}>
                                {transaction.type === 'add' ? '+' : '-'}{parseFloat(transaction.amount || 0).toFixed(2)}
                              </td>
                              <td>{transaction.description || transaction.descriprion || 'N/A'}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settlement Modal */}
      {showSettlementModal && selectedSettlement && (
        <div className="modal-overlay-financial-cards" onClick={handleCloseSettlementModal}>
          <div className="modal-content-financial-cards" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-financial-cards">
              <h2>Settle Transactions</h2>
              <button className="modal-close-financial-cards" onClick={handleCloseSettlementModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleSettle} className="modal-form-financial-cards">
              <div className="form-group-financial-cards">
                <label>Card</label>
                <input 
                  type="text" 
                  value={`${selectedSettlement.card_holder || 'N/A'} - ${selectedSettlement.card_number || 'N/A'}`} 
                  disabled 
                />
              </div>
              
              <div className="form-group-financial-cards">
                <label className="settlement-transactions-label-financial-cards">
                  <span className="settlement-transactions-icon-financial-cards">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 5V19M5 12H19" stroke="#004B71" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M4 4L6 4L4 6" stroke="#004B71" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="#004B71"/>
                      <path d="M20 4L18 4L20 6" stroke="#004B71" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="#004B71"/>
                      <path d="M4 20L6 20L4 18" stroke="#004B71" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="#004B71"/>
                      <path d="M20 20L18 20L20 18" stroke="#004B71" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="#004B71"/>
                    </svg>
                  </span>
                  Transactions to Settle
                </label>
                <div className="settlement-transactions-list-financial-cards">
                  {selectedSettlement.transactions
                    .filter(t => selectedTransactionIds.includes(t.id))
                    .map(transaction => (
                      <div key={transaction.id} className="settlement-transaction-item-financial-cards">
                        <div className="settlement-transaction-content-financial-cards">
                          <div>
                            <strong>{new Date(transaction.date).toLocaleDateString()}</strong> - {transaction.description || 'N/A'}
                          </div>
                          <div className="settlement-transaction-amount-financial-cards">
                            LKR {parseFloat(transaction.amount || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="form-group-financial-cards">
                <label>Settlement Amount (Topup Amount)</label>
                <input
                  type="number"
                  step="0.01"
                  value={settlementAmount}
                  onChange={(e) => setSettlementAmount(e.target.value)}
                  placeholder="Enter settlement amount"
                  required
                  min="0.01"
                />
                <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                  This amount will be added to the card as a topup transaction
                </small>
              </div>

              <div className="form-group-financial-cards">
                <label>Transaction Slip No (Description)</label>
                <input
                  type="text"
                  value={settlementDescription}
                  onChange={(e) => setSettlementDescription(e.target.value)}
                  placeholder="Enter transaction slip number or description"
                  required
                />
              </div>

              <div className="form-group-financial-cards">
                <label>Proof image (optional)</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => selectProofImageFile(e.target.files?.[0] || null, setSettlementImage, e.target)}
                />
                <small className="settle-proof-hint-financial-cards">
                  Max file size: {SETTLEMENT_PROOF_MAX_LABEL} (image or PDF)
                </small>
                {settlementImage ? (
                  <small className="settle-proof-selected-financial-cards">
                    Selected: {settlementImage.name} ({formatProofFileSize(settlementImage.size)})
                  </small>
                ) : null}
              </div>

              <div style={{ 
                padding: '12px', 
                backgroundColor: '#e8f4f8', 
                borderRadius: '8px', 
                marginBottom: '16px',
                border: '1px solid #004B71'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong>Total Transactions:</strong>
                  <span>{selectedTransactionIds.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong>Total Amount:</strong>
                  <span>LKR {selectedSettlement.transactions
                    .filter(t => selectedTransactionIds.includes(t.id))
                    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
                    .toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '600', color: '#004B71' }}>
                  <strong>Settlement Amount:</strong>
                  <span>LKR {parseFloat(settlementAmount || 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="modal-actions-financial-cards">
                <button type="button" className="btn-cancel-financial-cards" onClick={handleCloseSettlementModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit-financial-cards" disabled={isSettling}>
                  {isSettling ? 'Settling...' : 'Settle & Topup'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeclineVoucherModal && selectedFinanceDeclineTarget ? (
        <div
          className="modal-overlay-financial-cards"
          onClick={() => !decliningFinanceVoucher && setShowDeclineVoucherModal(false)}
        >
          <div
            className="modal-content-financial-cards decline-voucher-modal-financial-cards"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-financial-cards">
              <h2>Decline</h2>
              <button
                type="button"
                className="modal-close-financial-cards"
                onClick={() => !decliningFinanceVoucher && setShowDeclineVoucherModal(false)}
              >
                ×
              </button>
            </div>
            <div className="decline-voucher-modal-body-financial-cards">
              <p className="decline-voucher-hint-financial-cards">
                {selectedFinanceDeclineTarget.voucher_status === 'declined'
                  ? 'This voucher was declined in approval. Finance can decline it here with a reason, or use Create Voucher to resubmit.'
                  : 'Decline selected fuel transactions before a voucher is created. Pending or approved vouchers cannot be declined here.'}
              </p>
              <div className="decline-voucher-summary-financial-cards">
                {selectedFinanceDeclineTarget.voucher_no ? (
                  <div className="decline-voucher-summary-row-financial-cards">
                    <span className="decline-voucher-summary-label-financial-cards">Voucher</span>
                    <strong>{selectedFinanceDeclineTarget.voucher_no}</strong>
                  </div>
                ) : null}
                <div className="decline-voucher-summary-row-financial-cards">
                  <span className="decline-voucher-summary-label-financial-cards">Selection</span>
                  <strong>
                    {selectedFinanceDeclineTarget.transaction_count} transaction
                    {selectedFinanceDeclineTarget.transaction_count === 1 ? '' : 's'} · LKR{' '}
                    {selectedFinanceDeclineTarget.total_amount.toFixed(2)}
                  </strong>
                </div>
              </div>
              <div className="decline-voucher-reason-field-financial-cards">
                <label htmlFor="finance-decline-voucher-reason" className="decline-voucher-field-label-financial-cards">
                  Decline reason <span className="required-financial-cards">*</span>
                </label>
                <textarea
                  id="finance-decline-voucher-reason"
                  className="decline-voucher-textarea-financial-cards"
                  rows={4}
                  placeholder="Enter reason for declining these transactions..."
                  value={declineVoucherReason}
                  onChange={(e) => setDeclineVoucherReason(e.target.value)}
                  disabled={decliningFinanceVoucher}
                />
              </div>
            </div>
            <div className="decline-voucher-actions-financial-cards modal-actions-financial-cards">
              <button
                type="button"
                className="btn-cancel-financial-cards"
                disabled={decliningFinanceVoucher}
                onClick={() => setShowDeclineVoucherModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-decline-voucher-financial-cards"
                disabled={decliningFinanceVoucher || !declineVoucherReason.trim()}
                onClick={() => void handleFinanceDeclineVoucher()}
              >
                {decliningFinanceVoucher ? 'Declining...' : 'Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCreateVoucherModal && hasCreateVoucherFeature ? (
        <div className="modal-overlay-financial-cards" onClick={() => !creatingVoucher && setShowCreateVoucherModal(false)}>
          <div className="modal-content-financial-cards create-voucher-modal-financial-cards" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-financial-cards">
              <h2>Create Transport Voucher</h2>
              <button type="button" className="modal-close-financial-cards" onClick={() => setShowCreateVoucherModal(false)}>×</button>
            </div>
            <div className="create-voucher-modal-body-financial-cards">
              <div className="create-voucher-summary-financial-cards">
                <div className="create-voucher-stat-financial-cards">
                  <span className="create-voucher-stat-label-financial-cards">Transactions</span>
                  <strong>{selectedEligibleRows.length}</strong>
                </div>
                <div className="create-voucher-stat-financial-cards">
                  <span className="create-voucher-stat-label-financial-cards">Cards</span>
                  <strong>{createVoucherPreviewGroups.length}</strong>
                </div>
                <div className="create-voucher-stat-financial-cards create-voucher-stat-total-financial-cards">
                  <span className="create-voucher-stat-label-financial-cards">Voucher Total</span>
                  <strong>LKR {createVoucherPreviewTotal.toFixed(2)}</strong>
                </div>
              </div>

              <p className="create-voucher-hint-financial-cards">
                Review the selected fuel transactions below. The voucher will be created as pending until MD or physical approval.
              </p>

              <div className="create-voucher-preview-scroll-financial-cards">
                {createVoucherPreviewGroups.map((group) => (
                  <div key={group.card_id} className="create-voucher-card-group-financial-cards">
                    <div className="create-voucher-card-group-header-financial-cards">
                      <div>
                        <strong>{groupDriverLabel(group.transactions)}</strong>
                        <span>{group.card_number || 'N/A'}</span>
                      </div>
                      <span className="create-voucher-card-subtotal-financial-cards">
                        {group.transactions.length} tx · LKR {group.subtotal.toFixed(2)}
                      </span>
                    </div>
                    <table className="create-voucher-preview-table-financial-cards">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Time</th>
                          <th>Fuel Details</th>
                          <th>Admin Approver</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.transactions.map((row) => (
                          <tr key={row.id}>
                            <td>{row.date ? new Date(row.date).toLocaleDateString() : '-'}</td>
                            <td>{row.time || '-'}</td>
                            <td className="fuel-details-cell-financial-cards">
                              {formatFuelVoucherDescription(row)}
                            </td>
                            <td>{row.approved_by_name || '-'}</td>
                            <td className="create-voucher-amount-col-financial-cards">
                              LKR {Number(row.amount || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>

              <div className="create-voucher-footer-total-financial-cards">
                <span>Grand Total ({selectedEligibleRows.length} transaction{selectedEligibleRows.length === 1 ? '' : 's'})</span>
                <strong>LKR {createVoucherPreviewTotal.toFixed(2)}</strong>
              </div>
            </div>
            <div className="modal-actions-financial-cards">
              <button type="button" className="btn-cancel-financial-cards" onClick={() => setShowCreateVoucherModal(false)}>Cancel</button>
              <button type="button" className="btn-submit-financial-cards" disabled={creatingVoucher || !selectedEligibleRows.length} onClick={handleCreateVoucher}>
                {creatingVoucher ? 'Creating...' : 'Confirm & Create'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {physicalApprovalVoucher ? (
        <div className="modal-overlay-financial-cards" onClick={() => !isRecordingPhysicalApproval && setPhysicalApprovalVoucher(null)}>
          <div className="modal-content-financial-cards" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header-financial-cards">
              <h2>Upload Physical Approval</h2>
              <button
                type="button"
                className="modal-close-financial-cards"
                onClick={() => !isRecordingPhysicalApproval && setPhysicalApprovalVoucher(null)}
                disabled={isRecordingPhysicalApproval}
              >
                ×
              </button>
            </div>
            <form onSubmit={handlePhysicalApproval}>
              <div className="physical-approval-form-financial-cards">
                <p style={{ marginTop: 0, color: '#475569' }}>
                  Voucher <strong>{physicalApprovalVoucher.voucher_no}</strong>
                </p>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Approver (MD)</label>
                <select
                  value={physicalApproverId}
                  onChange={(e) => setPhysicalApproverId(e.target.value)}
                  required
                  className="physical-approval-select-financial-cards"
                >
                  <option value="">-- Select MD approver --</option>
                  {mdUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email || `User #${u.id}`}
                    </option>
                  ))}
                </select>
                {mdUsers.length === 0 ? (
                  <small style={{ display: 'block', marginTop: 6, color: '#b45309' }}>
                    No MD users found. Add or activate users with job role MD.
                  </small>
                ) : null}
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, marginTop: 12 }}>Signed voucher image</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  required
                  onChange={(e) => selectProofImageFile(e.target.files?.[0] || null, setPhysicalApprovalImage, e.target)}
                  className="physical-approval-file-financial-cards"
                />
                <small className="settle-proof-hint-financial-cards">
                  Max file size: {SETTLEMENT_PROOF_MAX_LABEL} (image or PDF)
                </small>
                {physicalApprovalImage ? (
                  <small className="settle-proof-selected-financial-cards">
                    Selected: {physicalApprovalImage.name} ({formatProofFileSize(physicalApprovalImage.size)})
                  </small>
                ) : null}
              </div>
              <div className="modal-actions-financial-cards">
                <button
                  type="button"
                  className="btn-cancel-financial-cards"
                  onClick={() => !isRecordingPhysicalApproval && setPhysicalApprovalVoucher(null)}
                  disabled={isRecordingPhysicalApproval}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit-financial-cards"
                  disabled={isRecordingPhysicalApproval || !physicalApproverId || !physicalApprovalImage || mdUsers.length === 0}
                >
                  {isRecordingPhysicalApproval ? (
                    <>
                      <span className="financial-cards-btn-spinner financial-cards-btn-spinner-light" aria-hidden="true" />
                      Saving…
                    </>
                  ) : (
                    'Save Approval'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {settlementProofPreviewUrl ? (
        <div
          className="modal-overlay-financial-cards settlement-proof-overlay-financial-cards"
          onClick={() => setSettlementProofPreviewUrl(null)}
        >
          <div
            className="settlement-proof-preview-modal-financial-cards"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-financial-cards">
              <h2>Settlement Proof</h2>
              <button
                type="button"
                className="modal-close-financial-cards"
                onClick={() => setSettlementProofPreviewUrl(null)}
              >
                ×
              </button>
            </div>
            <div className="settlement-proof-preview-body-financial-cards">
              <img
                src={settlementProofPreviewUrl}
                alt="Settlement proof"
                className="settlement-proof-preview-image-financial-cards"
              />
            </div>
          </div>
        </div>
      ) : null}

      {printVoucher ? (
        <TransportVoucherPrint
          voucher={printVoucher}
          onClose={() => setPrintVoucher(null)}
          onPrint={() => window.print()}
        />
      ) : null}

      {pendingViewCard ? (
        <CardPendingSpendsDialog
          card={pendingViewCard}
          pendingSettlements={pendingSettlements}
          onClose={() => setPendingViewCard(null)}
          onGoToSettlements={() => {
            setPendingViewCard(null);
            setActiveTab('settlements');
          }}
        />
      ) : null}

      <ToastContainer position="top-right" autoClose={4000} closeOnClick pauseOnHover />
    </div>
  );
};

const CardPendingSpendsDialog = ({ card, pendingSettlements, onClose, onGoToSettlements }) => {
  const cardGroup = pendingSettlements.find((s) => Number(s.card_id) === Number(card?.id));
  const pendingRows = (cardGroup?.transactions || []).filter(
    (t) =>
      t.type === 'use' &&
      Number(t.approved) === 1 &&
      Number(t.settled) !== 1 &&
      t.voucher_status !== 'finance_declined'
  );
  const total = pendingRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  return (
    <div className="modal-overlay-financial-cards" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content-financial-cards card-pending-view-modal-financial-cards" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-financial-cards">
          <h2>Pending Settlements</h2>
          <button type="button" className="modal-close-financial-cards" onClick={onClose}>×</button>
        </div>
        <div className="card-pending-view-body-financial-cards">
          <div className="card-pending-view-meta-financial-cards">
            <span><strong>{card?.card_holder || '—'}</strong></span>
            <span>Balance: LKR {Number(card?.amount || 0).toFixed(2)}</span>
            <span>{pendingRows.length} pending transaction{pendingRows.length === 1 ? '' : 's'}</span>
          </div>
          <p className="card-pending-view-hint-financial-cards">
            View only. Create and settle fuel transport vouchers from the Transactions to Settle tab.
          </p>
          {pendingRows.length === 0 ? (
            <div className="card-pending-view-empty-financial-cards">
              No approved spends pending settlement on this card.
            </div>
          ) : (
            <div className="card-pending-view-table-wrap-financial-cards">
              <table className="card-pending-view-table-financial-cards">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Fuel Details</th>
                    <th>Voucher Status</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.date ? new Date(row.date).toLocaleDateString() : '-'}</td>
                      <td className="fuel-details-cell-financial-cards">
                        {formatFuelVoucherDescription(row)}
                      </td>
                      <td>
                        <span className={`voucher-status-pill-financial-cards ${row.voucher_status || 'not_create'}`}>
                          {voucherStatusLabel(row.voucher_status)}
                        </span>
                      </td>
                      <td className="card-pending-view-amount-financial-cards">
                        LKR {Number(row.amount || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="card-pending-view-total-label-financial-cards">Total</td>
                    <td className="card-pending-view-amount-financial-cards">LKR {total.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
        <div className="modal-actions-financial-cards card-pending-view-actions-financial-cards">
          <button type="button" className="btn-cancel-financial-cards" onClick={onClose}>Close</button>
          {pendingRows.length > 0 ? (
            <button type="button" className="btn-submit-financial-cards" onClick={onGoToSettlements}>
              Go to Transactions to Settle
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default FinancialCards;

