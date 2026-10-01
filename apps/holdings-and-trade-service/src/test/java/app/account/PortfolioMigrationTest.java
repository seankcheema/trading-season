package app.account;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import static org.junit.jupiter.api.Assertions.*;

class PortfolioMigrationTest {
    @Test
    void migrationAddsIndexedHistoryWithAccountIsolationAndCascade() throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:h2:mem:portfolio_migration;MODE=PostgreSQL");
             var statement = connection.createStatement()) {
            statement.execute("create table accounts(account_id integer primary key)");
            ScriptUtils.executeSqlScript(connection, new ByteArrayResource(Files.readAllBytes(
                    Path.of("../market-data/db/migrations/V009__Portfolio_valuations.sql"))));
            statement.execute("insert into accounts values (1)");
            statement.execute("insert into portfolio_valuations(account_id, observed_at, portfolio_value) values (1, CURRENT_TIMESTAMP, 100.50)");
            assertThrows(java.sql.SQLException.class, () -> statement.execute(
                    "insert into portfolio_valuations(account_id, observed_at, portfolio_value) values (2, CURRENT_TIMESTAMP, 100)"));
            assertThrows(java.sql.SQLException.class, () -> statement.execute(
                    "insert into portfolio_valuations(account_id, observed_at, portfolio_value) values (1, CURRENT_TIMESTAMP, -1)"));
            statement.execute("delete from accounts where account_id=1");
            try (var result = statement.executeQuery("select count(*) from portfolio_valuations")) {
                assertTrue(result.next());
                assertEquals(0, result.getInt(1));
            }
        }
    }
}
