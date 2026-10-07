package app.user;

import org.junit.jupiter.api.Test;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import static org.junit.jupiter.api.Assertions.*;

class ExecutionBufferMigrationTest {
    @Test void migratesZeroPreservesNonzeroAndDefaultsToOne() throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:h2:mem:buffer_migration;MODE=PostgreSQL");
             var statement = connection.createStatement()) {
            statement.execute("create table users(id integer primary key, execution_buffer_percent numeric(5,2) default 0 not null)");
            statement.execute("create table orders(order_id integer primary key)");
            statement.execute("insert into users values (1,0),(2,2.5),(3,15)");
            String migration = Files.readString(Path.of("../../db/migrations/V010__Enforce_execution_buffers.sql"));
            for (String sql : migration.split(";")) if (!sql.isBlank()) statement.execute(sql.replace("timestamptz", "timestamp with time zone"));
            statement.execute("insert into users(id) values (4)");
            try (var result = statement.executeQuery("select execution_buffer_percent from users order by id")) {
                for (String expected : new String[]{"1.00", "2.50", "15.00", "1.00"}) {
                    assertTrue(result.next()); assertEquals(expected, result.getBigDecimal(1).toPlainString());
                }
            }
            statement.execute("update users set execution_buffer_percent=0 where id=1");
            statement.execute("insert into orders(order_id,session_id,executed_simulated_at) values (1,7,CURRENT_TIMESTAMP)");
        }
    }
}
