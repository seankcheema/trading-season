package app.user;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("unit")
class UserNotFoundExceptionTest {

    @Test
    void exceptionWithMessage() {
        String message = "User not found";
        UserNotFoundException exception = new UserNotFoundException(message);

        assertEquals(message, exception.getMessage());
    }

    @Test
    void exceptionIsThrowable() {
        UserNotFoundException exception = new UserNotFoundException("Test message");

        assertThrows(UserNotFoundException.class, () -> {
            throw exception;
        });
    }

    @Test
    void exceptionWithDefaultMessage() {
        UserNotFoundException exception = new UserNotFoundException("Account does not exist");

        assertNotNull(exception.getMessage());
        assertTrue(exception.getMessage().contains("does not exist"));
    }

    @Test
    void exceptionWithMultipleInstances() {
        UserNotFoundException exception1 = new UserNotFoundException("Error 1");
        UserNotFoundException exception2 = new UserNotFoundException("Error 2");

        assertEquals("Error 1", exception1.getMessage());
        assertEquals("Error 2", exception2.getMessage());
    }

    @Test
    void exceptionStackTrace() {
        UserNotFoundException exception = new UserNotFoundException("Test");

        assertNotNull(exception.getStackTrace());
    }
}
