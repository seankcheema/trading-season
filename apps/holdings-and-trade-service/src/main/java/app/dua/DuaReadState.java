package app.dua;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Column;

/** Schema mapping for immutable, independently acknowledged insight versions. */
@Entity
@Table(name = "dua_read_state")
public class DuaReadState {
    @Id
    private String id;
    @Column(name = "user_id", nullable = false)
    private java.util.UUID userId;
    @Column(name = "account_id", nullable = false)
    private Integer accountId;
    @Column(name = "session_id", nullable = false)
    private Long sessionId;
    @Column(nullable = false, length = 16)
    private String insight;
    @Column(nullable = false, length = 32)
    private String symbol;
    @Column(nullable = false, length = 4096)
    private String version;

    /** Creates the persistence mapping. */
    public DuaReadState() { }
}
