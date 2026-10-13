package com.rce.lms.user;

public record PreferencesResponse(boolean assignment, boolean notice, boolean feedback, boolean email) {
    public static PreferencesResponse defaults() { return new PreferencesResponse(true, true, true, false); }
}
