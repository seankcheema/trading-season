import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Partitioners, logLevel, type Producer } from 'kafkajs';
import type { User } from '../users/user.entity.js';

/** The topic the trading services and this one publish reporting's records to. */
export const PLATFORM_RECORDS_TOPIC = 'platform-records';

/** The record type a sign-in is published under. */
export const SIGN_IN_RECORD_TYPE = 'SIGN_IN';

/**
 * A sign-in as the reporting service sees it. Everything but the password
 * hash, which never leaves this service.
 */
export interface SignInRecord {
  type: typeof SIGN_IN_RECORD_TYPE;
  userId: string;
  email: string;
  role: string;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

function iso(value: Date | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

/** Builds the message body for a credential record, field by field so the hash cannot ride along. */
export function toSignInRecord(user: User): SignInRecord {
  return {
    type: SIGN_IN_RECORD_TYPE,
    userId: user.id,
    email: user.email,
    role: user.role,
    failedLoginAttempts: user.failedAttempts ?? 0,
    lockedUntil: iso(user.lockedUntil),
    createdAt: iso(user.createdAt),
    updatedAt: iso(user.updatedAt),
  };
}

/**
 * Publishes the state of a sign-in to Kafka whenever this service changes it:
 * a registration, a failed attempt, a lock and its release.
 *
 * The reporting service has no database connection, so this is how it knows
 * who can sign in, with which role, and who is locked out. Each message is
 * keyed `SIGN_IN:<user id>`, so every state of one sign-in lands on the same
 * partition in order and the topic can be compacted to the latest.
 *
 * Publishing can never change the outcome of a login. `publish` returns at
 * once and never throws: messages are sent one after another in the
 * background, and a broker that is down is logged, not surfaced. Set
 * `EVENTS_ENABLED=false`, or leave `KAFKA_BOOTSTRAP_SERVERS` unset, to turn
 * publishing off.
 */
@Injectable()
export class SignInPublisher implements OnModuleDestroy {
  private readonly logger = new Logger(SignInPublisher.name);
  private producer: Producer | null = null;
  /** Sends run one at a time in publish order; this is the tail of that chain. */
  private pending: Promise<void> = Promise.resolve();

  /** Whether sign-ins are published: needs a broker address and no opt-out. */
  isEnabled(): boolean {
    const optedOut = (process.env.EVENTS_ENABLED ?? 'true').toLowerCase() === 'false';
    return !optedOut && this.brokers().length > 0;
  }

  /** Queue the current state of a sign-in for publishing. Returns at once and never throws. */
  publish(user: User): void {
    if (!this.isEnabled()) {
      return;
    }
    const record = toSignInRecord(user);
    this.pending = this.pending.then(() => this.send(record));
  }

  /** Resolves once everything queued so far has been sent or has failed. */
  flush(): Promise<void> {
    return this.pending;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pending;
    if (this.producer) {
      await this.producer.disconnect().catch(() => undefined);
      this.producer = null;
    }
  }

  /** Overridden in tests; creates the client for the configured brokers. */
  protected createProducer(): Producer {
    const kafka = new Kafka({
      clientId: 'auth-service',
      brokers: this.brokers(),
      // The login that queued this is already answered; do not hang on a dead broker.
      connectionTimeout: 3000,
      requestTimeout: 5000,
      retry: { retries: 1 },
      logLevel: logLevel.NOTHING,
    });
    return kafka.producer({
      // Auto-creation is off on the broker; a missing topic must fail, not appear.
      allowAutoTopicCreation: false,
      // The Java-compatible partitioner, so a key always maps to the same partition.
      createPartitioner: Partitioners.DefaultPartitioner,
    });
  }

  private brokers(): string[] {
    return (process.env.KAFKA_BOOTSTRAP_SERVERS ?? '')
      .split(',')
      .map((broker) => broker.trim())
      .filter((broker) => broker.length > 0);
  }

  private async send(record: SignInRecord): Promise<void> {
    const key = `${SIGN_IN_RECORD_TYPE}:${record.userId}`;
    try {
      if (!this.producer) {
        const producer = this.createProducer();
        await producer.connect();
        this.producer = producer;
      }
      await this.producer.send({
        topic: PLATFORM_RECORDS_TOPIC,
        messages: [{ key, value: JSON.stringify(record) }],
      });
      this.logger.log(`Published platform record key=${key}`);
    } catch (error) {
      this.logger.error(
        `Failed to publish platform record key=${key}: ${(error as Error)?.message ?? error}`,
      );
      // Start from a fresh connection next time instead of reusing a broken one.
      const broken = this.producer;
      this.producer = null;
      await broken?.disconnect().catch(() => undefined);
    }
  }
}
