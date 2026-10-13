import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PLATFORM_RECORDS_TOPIC,
  SignInPublisher,
  toSignInRecord,
} from './sign-in-publisher.service.js';
import { User } from '../users/user.entity.js';

function signIn(overrides: Partial<User> = {}): User {
  return {
    id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    email: 'trader@example.com',
    password: '$2b$10$secret-hash',
    role: 'TRADER',
    failedAttempts: 2,
    lockedUntil: null,
    createdAt: new Date('2026-10-01T09:00:00Z'),
    updatedAt: new Date('2026-10-05T09:30:00Z'),
    ...overrides,
  } as User;
}

class FakeProducerPublisher extends SignInPublisher {
  producerMock = {
    connect: vi.fn(async () => undefined),
    send: vi.fn(async (_payload: unknown) => undefined),
    disconnect: vi.fn(async () => undefined),
  };
  created = 0;

  protected override createProducer() {
    this.created += 1;
    return this.producerMock as never;
  }
}

describe('SignInPublisher', () => {
  const originalEnv = { ...process.env };
  let publisher: FakeProducerPublisher;

  beforeEach(() => {
    process.env.KAFKA_BOOTSTRAP_SERVERS = 'localhost:29092';
    delete process.env.EVENTS_ENABLED;
    publisher = new FakeProducerPublisher();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('builds a record without the password hash', () => {
    const record = toSignInRecord(signIn());

    expect(record).toEqual({
      type: 'SIGN_IN',
      userId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      email: 'trader@example.com',
      role: 'TRADER',
      failedLoginAttempts: 2,
      lockedUntil: null,
      createdAt: '2026-10-01T09:00:00.000Z',
      updatedAt: '2026-10-05T09:30:00.000Z',
    });
    expect(JSON.stringify(record)).not.toContain('secret-hash');
  });

  it('sends one message keyed by record type and user id', async () => {
    const lockedUntil = new Date('2026-10-05T09:45:00Z');

    publisher.publish(signIn({ failedAttempts: 5, lockedUntil }));
    await publisher.flush();

    expect(publisher.producerMock.connect).toHaveBeenCalledTimes(1);
    expect(publisher.producerMock.send).toHaveBeenCalledTimes(1);
    const payload = publisher.producerMock.send.mock.calls[0][0] as {
      topic: string;
      messages: { key: string; value: string }[];
    };
    expect(payload.topic).toBe(PLATFORM_RECORDS_TOPIC);
    expect(payload.messages[0].key).toBe('SIGN_IN:7c9e6679-7425-40de-944b-e07fc1f90ae7');
    const body = JSON.parse(payload.messages[0].value);
    expect(body.failedLoginAttempts).toBe(5);
    expect(body.lockedUntil).toBe('2026-10-05T09:45:00.000Z');
    expect(payload.messages[0].value).not.toContain('secret-hash');
  });

  it('sends in publish order over one connection', async () => {
    publisher.publish(signIn({ failedAttempts: 4 }));
    publisher.publish(signIn({ failedAttempts: 5 }));
    await publisher.flush();

    expect(publisher.created).toBe(1);
    const attempts = publisher.producerMock.send.mock.calls.map(
      (call) => JSON.parse((call[0] as { messages: { value: string }[] }).messages[0].value).failedLoginAttempts,
    );
    expect(attempts).toEqual([4, 5]);
  });

  it('returns before the broker answers, so a login never waits on it', async () => {
    let release: () => void = () => undefined;
    publisher.producerMock.send.mockImplementationOnce(
      () => new Promise<undefined>((resolve) => { release = () => resolve(undefined); }),
    );

    // publish() has returned although the broker has not answered and will not until released.
    publisher.publish(signIn());
    await vi.waitFor(() => expect(publisher.producerMock.send).toHaveBeenCalledTimes(1));
    let settled = false;
    void publisher.flush().then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);

    release();
    await publisher.flush();
    expect(settled).toBe(true);
  });

  it('logs a broker failure, never throws, and reconnects for the next record', async () => {
    publisher.producerMock.send.mockRejectedValueOnce(new Error('broker down'));

    expect(() => publisher.publish(signIn())).not.toThrow();
    await expect(publisher.flush()).resolves.toBeUndefined();
    expect(publisher.producerMock.disconnect).toHaveBeenCalledTimes(1);

    publisher.publish(signIn());
    await publisher.flush();
    expect(publisher.created).toBe(2);
    expect(publisher.producerMock.send).toHaveBeenCalledTimes(2);
  });

  it('survives a connection that cannot be opened', async () => {
    publisher.producerMock.connect.mockRejectedValueOnce(new Error('no brokers reachable'));

    publisher.publish(signIn());

    await expect(publisher.flush()).resolves.toBeUndefined();
    expect(publisher.producerMock.send).not.toHaveBeenCalled();
  });

  it('publishes nothing when EVENTS_ENABLED is false', async () => {
    process.env.EVENTS_ENABLED = 'false';

    publisher.publish(signIn());
    await publisher.flush();

    expect(publisher.isEnabled()).toBe(false);
    expect(publisher.created).toBe(0);
  });

  it('publishes nothing without a broker address', async () => {
    delete process.env.KAFKA_BOOTSTRAP_SERVERS;

    publisher.publish(signIn());
    await publisher.flush();

    expect(publisher.isEnabled()).toBe(false);
    expect(publisher.created).toBe(0);
  });

  it('disconnects when the module is destroyed', async () => {
    publisher.publish(signIn());

    await publisher.onModuleDestroy();

    expect(publisher.producerMock.send).toHaveBeenCalledTimes(1);
    expect(publisher.producerMock.disconnect).toHaveBeenCalledTimes(1);
  });

  it('builds a real client for the configured brokers without connecting', () => {
    const real = new (class extends SignInPublisher {
      build() {
        return this.createProducer();
      }
    })();

    expect(typeof real.build().send).toBe('function');
  });
});
