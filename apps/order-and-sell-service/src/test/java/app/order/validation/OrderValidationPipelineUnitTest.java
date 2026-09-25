package app.order.validation;

import app.account.Account;
import app.instrument.Instrument;
import app.order.Order;
import app.order.dto.OrderRequest;
import app.user.User;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Tag("unit")
class OrderValidationPipelineUnitTest {

    @Mock
    private OrderValidator first;

    @Mock
    private OrderValidator second;

    @Mock
    private OrderValidator third;

    private OrderRequest request() {
        return new OrderRequest(1, 1, Order.TYPE_BUY, BigDecimal.TEN,
                BigDecimal.valueOf(100), null, UUID.randomUUID());
    }

    @Test
    void passesWhenEveryValidatorPasses() {
        when(first.validate(any(), any(), any(), any())).thenReturn(ValidationResult.pass());
        when(second.validate(any(), any(), any(), any())).thenReturn(ValidationResult.pass());
        when(third.validate(any(), any(), any(), any())).thenReturn(ValidationResult.pass());

        OrderValidationPipeline pipeline = new OrderValidationPipeline(List.of(first, second, third));
        ValidationResult result = pipeline.run(request(), new User(), new Account(), new Instrument());

        assertTrue(result.passed());
    }

    @Test
    void stopsAtTheFirstRejectionAndSkipsLaterValidators() {
        when(first.validate(any(), any(), any(), any())).thenReturn(ValidationResult.pass());
        when(second.validate(any(), any(), any(), any())).thenReturn(ValidationResult.reject("rule 2 failed"));

        OrderValidationPipeline pipeline = new OrderValidationPipeline(List.of(first, second, third));
        ValidationResult result = pipeline.run(request(), new User(), new Account(), new Instrument());

        assertEquals(false, result.passed());
        assertEquals("rule 2 failed", result.reason());
        verify(third, never()).validate(any(), any(), any(), any());
    }

    private static <T> T any() {
        return org.mockito.ArgumentMatchers.any();
    }
}