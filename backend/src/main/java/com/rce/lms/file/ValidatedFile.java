package com.rce.lms.file;

public record ValidatedFile(String fileName, String contentType, byte[] bytes) {}
