package com.rce.lms.user;

import jakarta.validation.constraints.NotNull;
import tools.jackson.core.JsonParser;
import tools.jackson.core.JsonToken;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.ValueDeserializer;
import tools.jackson.databind.annotation.JsonDeserialize;

public record PreferencesRequest(
    @NotNull @JsonDeserialize(using = BooleanInput.class) Boolean assignment,
    @NotNull @JsonDeserialize(using = BooleanInput.class) Boolean notice,
    @NotNull @JsonDeserialize(using = BooleanInput.class) Boolean feedback,
    @NotNull @JsonDeserialize(using = BooleanInput.class) Boolean email) {

    /** Preferences accept literal booleans, not Jackson's normal string/number coercion. */
    public static final class BooleanInput extends ValueDeserializer<Boolean> {
        @Override
        public Boolean deserialize(JsonParser parser, DeserializationContext context) {
            if (parser.currentToken() == JsonToken.VALUE_TRUE) return true;
            if (parser.currentToken() == JsonToken.VALUE_FALSE) return false;
            return context.reportInputMismatch(Boolean.class, "Expected a JSON boolean");
        }
    }
}
