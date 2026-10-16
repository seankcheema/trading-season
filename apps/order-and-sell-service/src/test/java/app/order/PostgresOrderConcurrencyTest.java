package app.order;

import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/** Runs the same lifecycle and concurrent-race contract against an explicitly disposable PostgreSQL database. */
@EnabledIfEnvironmentVariable(named = "ORDER_TEST_DISPOSABLE_POSTGRES_URL", matches = "jdbc:postgresql:.*")
class PostgresOrderConcurrencyTest extends OrderServiceTest {
    @DynamicPropertySource
    static void database(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", () -> System.getenv("ORDER_TEST_DISPOSABLE_POSTGRES_URL"));
        properties.add("spring.datasource.username", () -> System.getenv("ORDER_TEST_POSTGRES_USER"));
        properties.add("spring.datasource.password", () -> System.getenv("ORDER_TEST_POSTGRES_PASSWORD"));
        properties.add("spring.datasource.driverClassName", () -> "org.postgresql.Driver");
        properties.add("spring.jpa.hibernate.ddl-auto", () -> "create-drop");
    }
}
