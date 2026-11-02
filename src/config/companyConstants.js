/**
 * Company constants for documents (Purchase Order, etc.)
 * Kenilworth International
 *
 * Logo: store your company logo file in public/assets/images/ and set logoPath
 * to its path (e.g. '/assets/images/your-logo.png'). Used on PO and other docs.
 *
 * Monitoring: minutes per hectare for Pilot Start Mission countdown (e.g. 30 = 1 Ha per 30 min).
 */
export const COMPANY = {
  name: 'Kenilworth International',
  address: '7B, D.W.Rupasinghe mw, Nugegoda.',
  city: 'Nugegoda, Colombo',
  postalCode: '10100',
  phone: '',
  email: 'kenilworth.online@gmail.com',
  /** Government Unique Identifier (BR / Govt. UID). */
  govtUid: 'PV9489',
  /** Taxpayer Identification Number. */
  tinNo: '174948984 - 0000',
  /** Alias of tinNo for older PO/GRN docs that read taxId. */
  taxId: '174948984 - 0000',
  logoPath: '/assets/images/kenilowrthlogoDark.png',
  /** Minutes per Ha for ops monitoring countdown (1 Ha per 30 min → 2 Ha = 1 hour). Adjust here to change rate. */
  minutesPerHa: 30,
};

export default COMPANY;
