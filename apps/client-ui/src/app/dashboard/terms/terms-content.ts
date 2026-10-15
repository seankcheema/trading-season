// The platform terms a user accepts before using the dashboard.
//
// TERMS_VERSION names this wording by its effective date and is sent with the acceptance. It
// must equal UserService.CURRENT_TERMS_VERSION in Holdings and Trade Service, which refuses any
// other version. Change both together whenever a section below changes, so that every user is
// asked to accept the new wording.
export const TERMS_VERSION = '2026-10-15';

export interface TermsSection {
  title: string;
  paragraphs: readonly string[];
}

export const TERMS_SECTIONS: readonly TermsSection[] = [
  {
    title: '1. Business use and authorised access',
    paragraphs: [
      'These terms apply to business clients and the individual users they authorise to access TradingSeason for training, evaluation, and workflow familiarisation.',
      'By accepting them, you confirm that you are acting on your own behalf and, where applicable, with authority to use the platform for your employer or client organisation.',
    ],
  },
  {
    title: '2. Simulation-only platform',
    paragraphs: [
      'TradingSeason is a simulated environment only. It is not a brokerage, execution venue, custodian, clearing service, settlement platform, or investment advisory service.',
      'Orders, prices, balances, fills, and portfolio values shown in the application are generated or replayed for simulation purposes and must not be treated as live market instructions, executable prices, or records of any real account.',
    ],
  },
  {
    title: '3. No advice and no live-market reliance',
    paragraphs: [
      'Nothing in TradingSeason constitutes financial, investment, legal, tax, accounting, regulatory, or compliance advice.',
      'You and your organisation remain solely responsible for any real-world investment, treasury, legal, or compliance decision made outside the platform.',
    ],
  },
  {
    title: '4. Client and user responsibilities',
    paragraphs: [
      'You must provide accurate registration details, protect your credentials, and use the platform only for legitimate and authorised business purposes.',
      'You must not interfere with platform security, scrape protected data, impersonate another person, or use the platform to test abusive, manipulative, or unlawful trading conduct.',
    ],
  },
  {
    title: '5. Records and platform controls',
    paragraphs: [
      'The platform records your acceptance of this version of the terms, together with the time you accepted. If the terms change, you will be asked to accept the new version before continuing.',
      'Every order you confirm, the simulated price it is filled at, and the resulting changes to your simulated cash and holdings are recorded permanently against your account, with the time each occurred. A recorded order cannot be edited or deleted, and the name, date of birth, and sign-in email it is attributed to cannot be changed through the platform.',
      'The operator may suspend access, invalidate sessions, or restrict features where necessary to protect users, data integrity, or service operations.',
    ],
  },
  {
    title: '6. Availability and risk notice',
    paragraphs: [
      'Availability, replay completeness, and simulation accuracy are not guaranteed, and simulated results may differ materially from live-market outcomes.',
      'You should independently verify any concept, workflow, or output before using it in a live investing, brokerage, finance, or compliance setting.',
    ],
  },
];
