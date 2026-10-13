package app.record;

import com.fasterxml.jackson.annotation.JsonIgnore;

/**
 * The current state of one row that the reporting service shows and an order
 * status event does not carry. A service raises one inside the transaction
 * that wrote the row, and {@link PlatformRecordPublisher} sends it to Kafka
 * once that transaction has committed.
 *
 * <p>An implementation is the message body: serialised as JSON it carries its
 * own components, and the publisher adds {@code type}. It holds plain values,
 * not entities, because it is handled after the transaction and outside any
 * persistence context. It must never carry an SSN, an address, a date of
 * birth or a password hash.
 */
public interface PlatformRecord {

    /**
     * Names the kind of row, for example {@code CASH_TRANSFER}. Sent as the
     * body's {@code type} and as the first half of the message key.
     *
     * @return the record type
     */
    @JsonIgnore
    String recordType();

    /**
     * Identifies the row among others of its type. The second half of the
     * message key, so a later state of the same row replaces an earlier one
     * when the topic is compacted.
     *
     * @return the row's identifier as text
     */
    @JsonIgnore
    String recordId();
}
