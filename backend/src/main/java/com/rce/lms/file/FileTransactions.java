package com.rce.lms.file;

import com.rce.lms.common.ApiException;
import java.io.IOException;
import java.util.*;
import java.util.function.Function;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.*;
import org.springframework.web.multipart.MultipartFile;

@Component
public class FileTransactions {
    private final FileStorage storage;
    private final FileValidator validator;
    private final FileCleanup cleanup;
    private final TransactionTemplate transactions;
    public FileTransactions(FileStorage storage, FileValidator validator, FileCleanup cleanup, PlatformTransactionManager manager) {
        this.storage = storage;
        this.validator = validator;
        this.cleanup = cleanup;
        transactions = new TransactionTemplate(manager);
    }

    public <T> T replace(List<MultipartFile> uploads, boolean profile, Function<List<StoredUpload>, T> action) {
        if (TransactionSynchronizationManager.isActualTransactionActive()) throw new IllegalStateException("Upload must start outside a database transaction");
        List<MultipartFile> parts = uploads == null ? List.of() : uploads;
        if (parts.size() > (profile ? 1 : 5)) throw new ApiException(HttpStatus.BAD_REQUEST, "TOO_MANY_FILES", "첨부파일 개수 제한을 초과했습니다.");
        List<ValidatedFile> validated = parts.stream().map(part -> validator.validate(part, profile)).toList();
        List<StoredUpload> saved = new ArrayList<>();
        try {
            for (ValidatedFile file : validated) saved.add(storage.save(file));
            return transactions.execute(status -> action.apply(List.copyOf(saved)));
        } catch (IOException error) {
            cleanup.deleteSafely(saved.stream().map(StoredUpload::storageKey).toList());
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "FILE_STORAGE_ERROR", "파일을 저장하지 못했습니다. 다시 시도해 주세요.");
        } catch (RuntimeException error) {
            cleanup.deleteSafely(saved.stream().map(StoredUpload::storageKey).toList());
            throw error;
        }
    }

    public void deleteAfterCommit(Collection<String> keys) {
        if (keys.isEmpty()) return;
        if (!TransactionSynchronizationManager.isSynchronizationActive() || !TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("File replacement requires a database transaction");
        }
        List<String> snapshot = List.copyOf(keys);
        cleanup.recordWithinTransaction(snapshot);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { cleanup.deleteSafely(snapshot); }
        });
    }
}
