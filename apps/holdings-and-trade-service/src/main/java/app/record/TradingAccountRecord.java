package app.record;

import app.account.Account;

import java.time.LocalDate;
import java.util.UUID;

/**
 * A trading account, published as {@value #TYPE} when it is opened or
 * renamed or archived. It is what ties an account id, the key of every order event, to
 * its owner.
 *
 * @param accountId  the account
 * @param userId     the trader who owns it
 * @param name       the account's display name
 * @param openedDate the day it was opened
 * @param status ACTIVE or ARCHIVED
 * @param archivedAt archive timestamp, otherwise null
 * @param currency   the account's currency code
 */
public record TradingAccountRecord(
        Integer accountId,
        UUID userId,
        String name,
        LocalDate openedDate,
        String currency, String status, java.time.Instant archivedAt) implements PlatformRecord {

    /** The record type trading accounts are published under. */
    public static final String TYPE = "TRADING_ACCOUNT";

    /**
     * Captures a saved account.
     *
     * @param account the account after it was saved, so that it has its id
     * @return the record describing it
     */
    public static TradingAccountRecord from(Account account) {
        return new TradingAccountRecord(account.getAccountId(), account.getUserId(), account.getName(),
                account.getOpenedDate(), account.getCurrency(), account.getStatus(), account.getArchivedAt());
    }

    @Override
    public String recordType() {
        return TYPE;
    }

    @Override
    public String recordId() {
        return String.valueOf(accountId);
    }
}
