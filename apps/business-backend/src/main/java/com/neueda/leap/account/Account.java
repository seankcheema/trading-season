package com.neueda.leap.account;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * A brokerage/child account: the unit orders and holdings attach to/
 * A user can own more than one account (KAN-78, KAN-103/104)
 * Represents an account with an ID, name, and balance.
 * <p>{@code cashBalance} is a cache (BR-10) reconciled against
 * {@code cash_transactions} - order execution must update it by 
 * inserting a ledger row, never by writing this field directly.
 */

@Entity
@Table(name = "accounts")

public class Account {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "account_id", updatable = false, nullable = false)
   private Integer id;
@Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "cash_balance", nullable = false)
    private BigDecimal cashBalance = BigDecimal.ZERO;

    @Column(name = "opened_date", nullable = false)
    private LocalDate openedDate;

    @Column(nullable = false)
    private String currency = "USD";

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Integer getAccountId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public BigDecimal getCashBalance() {
        return cashBalance;
    }

    public void setCashBalance(BigDecimal cashBalance) {
        this.cashBalance = cashBalance;
    }

    public LocalDate getOpenedDate() {
        return openedDate;
    }

    public void setOpenedDate(LocalDate openedDate) {
        this.openedDate = openedDate;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }
}
