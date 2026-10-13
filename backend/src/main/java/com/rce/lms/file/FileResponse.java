package com.rce.lms.file;

import java.util.UUID;

/** Public file metadata never contains a storage key or filesystem path. */
public record FileResponse(UUID id, String name, long size, String type) {}
