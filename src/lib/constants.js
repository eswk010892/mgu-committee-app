export const DEFAULT_CFG = {
  name: 'Montreal Ganesh Utsav 2026',
  start_date: '2026-09-14',
  days: 5,
  goal: 25000,
  // Real values live in the database, never in this public repo. See
  // supabase/sponsorships.sql and the Setup tab.
  interac_email: '',
  interac_answer: '',
  contact_email: '',
  description: '',
}

/**
 * Used when festival_config.description is empty. Deliberately states no day
 * count — the header already prints one from festival_config, and a hard-coded
 * number here contradicted it the moment the festival went from 5 days to 6.
 */
export const DEFAULT_DESCRIPTION =
  'Aarti, prasad and celebration in Montreal, organised by the ' +
  'Montreal Ganesh Utsav Committee. Everyone is welcome.'

export const DEVA = ['प्रथम','द्वितीय','तृतीय','चतुर्थ','पंचम','षष्ठ','सप्तम','अष्टम','नवम','दशम','एकादश']

/** Money categories — how the donation arrived. */
export const MONEY_CATS = ['Interac', 'Cash', 'Cheque', 'Card', 'Other']

/** In-kind categories — what was given. */
export const GOODS_CATS = ['Food / prasad', 'Groceries', 'Decor', 'Puja items', 'Sound / light', 'Printing', 'Other']

export const TASK_CATS = ['Puja','Venue','Food','Decor','Sound','Marketing','Sponsors','Permits','Visarjan','Other']

export const ANON = 'Anonymous'

/** Suggested sponsorship categories. Free text — the committee can type its own. */
export const SPONSOR_CATS = ['Aarti', 'Prasad', 'Mahaprasad', 'Decor', 'Sound / light',
  'Puja items', 'Cultural programme', 'Printing', 'Venue', 'General']

/**
 * How a sponsor says they will pay. These values are written straight into
 * `donations.category` on confirmation, so they must stay inside MONEY_CATS.
 */
export const PAY_METHODS = [
  { value: 'Interac', label: 'Interac e-Transfer' },
  { value: 'Cash', label: 'Cash' },
  { value: 'Cheque', label: 'Cheque' },
  { value: 'Card', label: 'Card' },
]
