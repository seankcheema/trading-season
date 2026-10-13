package app.user;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * The client names the version of the terms it displays, and this service
 * refuses any other. If the two drift apart nobody can accept the terms, so
 * this fails the build as soon as one is changed without the other.
 *
 * <p>Skipped when the client sources are not beside this service, as in an
 * image built from this directory alone.
 */
@Tag("unit")
class TermsVersionConsistencyTest {

    private static final Path CLIENT_TERMS =
            Path.of("..", "client-ui", "src", "app", "dashboard", "terms", "terms-content.ts");

    private static final Pattern CLIENT_VERSION =
            Pattern.compile("export const TERMS_VERSION = '([^']+)';");

    @Test
    void theVersionInForceIsTheVersionTheClientDisplays() throws IOException {
        assumeTrue(Files.isRegularFile(CLIENT_TERMS), "client sources are not available");

        Matcher version = CLIENT_VERSION.matcher(Files.readString(CLIENT_TERMS));

        assertTrue(version.find(), "terms-content.ts no longer declares TERMS_VERSION");
        assertEquals(version.group(1), UserService.CURRENT_TERMS_VERSION);
    }
}
