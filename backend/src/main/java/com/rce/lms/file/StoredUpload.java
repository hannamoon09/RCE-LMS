package com.rce.lms.file;

public record StoredUpload(String storageKey, String fileName, String contentType, long size) {}
