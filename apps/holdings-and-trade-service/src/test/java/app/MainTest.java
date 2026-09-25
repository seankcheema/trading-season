package app;

import app.market.MarketController;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.UseMainMethod;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Starts the service through {@link Main#main} rather than a test-built application. The context
 * gets its own in-memory database so that its schema lifecycle cannot affect other cached contexts.
 */
@SpringBootTest(useMainMethod = UseMainMethod.ALWAYS, properties = {
        "spring.datasource.url=jdbc:h2:mem:main-startup;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "market.replay.tick-millis=600000"})
@ActiveProfiles("test")
class MainTest {

    @Autowired
    private ApplicationContext context;

    @Test
    void mainStartsTheApplication() {
        assertNotNull(context.getBean(MarketController.class));
    }
}
