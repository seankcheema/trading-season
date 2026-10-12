package app.record;

import app.account.Account;

import java.time.LocalDate;
import java.util.UUID;

/**
 * A trading account, published as {@value #TYPE} when it is opened or
 * renamed. It is what ties an account id, the key of every order event, to
 * its owner.
 *
 * @param accountId  the account
 * @param userId     the trader who owns it
 * @param name       the account's display name
 * @param openedDate the day it was opened
 * @param currency   the account's currency code
 */
public record TradingAccountRecord(
        Integer accountId,
        UUID userId,
        String name,
        LocalDate openedDate,
        String currency) implements PlatformRecord {

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
                account.getOpenedDate(), account.getCurrency());
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
