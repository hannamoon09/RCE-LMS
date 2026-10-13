package com.rce.lms.submission;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

/** Decimal validation rejects fractional input instead of silently truncating it to an integer. */
public record ReviewRequest(
    @NotNull @DecimalMin("0") @DecimalMax("100") @Digits(integer = 3, fraction = 0) BigDecimal score,
    @Size(max = 20000) String feedback
) {}
