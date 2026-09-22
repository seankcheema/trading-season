import { randomUUID } from 'node:crypto';

/** The registration form's fields, in the shape the form accepts them. */
export interface TestAccount {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  ssn: string;
  address: string;
  traderLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  availableFunds: number;
  password: string;
}

/**
 * Builds a registration that satisfies every client-side rule: an SSN in
 * XXX-XX-XXXX form, a past date of birth, funds at or above the 5000 minimum,
 * and a password with a digit and a special character.
 *
 * The email and SSN are unique per call so specs can run in parallel and so a
 * search of the request transcript for one test's SSN cannot match another's.
 */
export function newAccount(overrides: Partial<TestAccount> = {}): TestAccount {
  const unique = randomUUID().replaceAll('-', '').slice(0, 10);
  const ssnDigits = String(Math.floor(Math.random() * 900_000_000) + 100_000_000);

  return {
    firstName: 'Jane',
    middleName: '',
    lastName: 'Doe',
    email: `e2e-${unique}@example.com`,
    dateOfBirth: '1990-04-17',
    ssn: `${ssnDigits.slice(0, 3)}-${ssnDigits.slice(3, 5)}-${ssnDigits.slice(5, 9)}`,
    address: '123 Main St, Springfield',
    traderLevel: 'BEGINNER',
    availableFunds: 5000,
    password: `Str0ng!${unique}`,
    ...overrides,
  };
}
