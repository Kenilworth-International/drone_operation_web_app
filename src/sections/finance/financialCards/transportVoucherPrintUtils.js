export const formatVoucherDisplayDate = (value) => {
  if (!value) return '—';
  const text = String(value).trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[2]}/${match[3]}/${match[1]}`;
  const slice = text.slice(0, 10);
  const [y, m, day] = slice.split('-');
  if (y && m && day) return `${m}/${day}/${y}`;
  return slice || '—';
};

export const resolveVoucherApprovedBy = (voucher) => {
  if (voucher?.approval_mode === 'print') {
    return voucher?.physical_approved_by_name || voucher?.approved_by_name || '';
  }
  return voucher?.approved_by_display || voucher?.approved_by_name || '';
};

export const resolveVoucherApprovalType = (voucher) => {
  const mode = String(voucher?.approval_mode || '').trim().toLowerCase();
  if (mode === 'system') return 'System Approval';
  if (mode === 'print') return 'Physical Approval';
  if (voucher?.status === 'declined') {
    return voucher?.approval_mode === 'finance' ? 'Finance Declined' : 'Declined';
  }
  return '';
};

export const hasVoucherApprovalInfo = (voucher) => {
  const approvedBy = resolveVoucherApprovedBy(voucher);
  const approvalType = resolveVoucherApprovalType(voucher);
  return Boolean(approvedBy || approvalType);
};

export const isGeneratorFuelVoucher = (voucher) =>
  voucher?.voucher_type_code === 'generator' || /^GFV-/i.test(String(voucher?.voucher_no || ''));

/** Title, person column and notice text for transport vs generator fuel vouchers. */
export const getFuelVoucherLabels = (voucher) => {
  if (isGeneratorFuelVoucher(voucher)) {
    return {
      title: 'Generator Fuel Voucher',
      personHeader: 'PILOT',
      fileFallback: 'generator-fuel-voucher',
      notice:
        'This generator fuel voucher authorizes finance settlement for admin-approved generator fuel transactions. Upload settlement proof when the voucher is marked as settled. Fuel dates shown are generator fuel entry dates, not the voucher issue date.',
    };
  }
  return {
    title: 'Fuel Transport Voucher',
    personHeader: 'DRIVER',
    fileFallback: 'fuel-transport-voucher',
    notice:
      'This fuel transport voucher authorizes finance settlement for admin-approved driver fuel transactions. Upload settlement proof when the voucher is marked as settled. Fuel dates shown are driver fuel entry dates, not the voucher issue date.',
  };
};

export const resolveVoucherDriverName = (line) =>
  line?.driver_name || line?.pilot_name || line?.driver || '—';

export const resolveVoucherCardNumber = (line) =>
  line?.card_number || line?.card_no || line?.no_masked || '—';

export const resolveVoucherCardHolder = (line) => line?.card_holder || '';

/** Summarise distinct cards on a voucher (from lines or cards_summary). */
export const resolveVoucherCardsSummary = (voucher) => {
  if (Array.isArray(voucher?.cards_summary) && voucher.cards_summary.length) {
    return voucher.cards_summary;
  }
  const lines = voucher?.lines || [];
  const byCard = new Map();
  lines.forEach((line) => {
    const cardId = Number(line.card_id) || resolveVoucherCardNumber(line);
    if (!cardId || cardId === '—') return;
    if (!byCard.has(cardId)) {
      byCard.set(cardId, {
        card_id: Number(line.card_id) || null,
        card_number: resolveVoucherCardNumber(line),
        card_holder: resolveVoucherCardHolder(line),
        transaction_count: 0,
        amount: 0,
      });
    }
    const row = byCard.get(cardId);
    row.transaction_count += 1;
    row.amount += Number(line.amount) || 0;
  });
  return [...byCard.values()];
};

export const groupDriverLabel = (transactions = []) => {
  const names = [...new Set(transactions.map((t) => t.driver_name).filter(Boolean))];
  if (!names.length) return '—';
  return names.join(', ');
};
