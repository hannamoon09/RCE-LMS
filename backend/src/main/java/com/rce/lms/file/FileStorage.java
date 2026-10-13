package com.rce.lms.file;

import java.io.IOException;
import org.springframework.core.io.Resource;

public interface FileStorage {
    StoredUpload save(ValidatedFile file) throws IOException;
    Resource load(String storageKey) throws IOException;
    void delete(String storageKey) throws IOException;
}
