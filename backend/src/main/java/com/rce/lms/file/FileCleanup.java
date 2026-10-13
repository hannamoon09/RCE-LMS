package com.rce.lms.file;

import java.util.Collection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

@Component
public class FileCleanup {
    private static final Logger log = LoggerFactory.getLogger(FileCleanup.class);
    private final FileStorage storage;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate independent;

    public FileCleanup(FileStorage storage, JdbcTemplate jdbc, PlatformTransactionManager manager) {
        this.storage = storage;
        this.jdbc = jdbc;
        independent = new TransactionTemplate(manager);
        independent.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public void deleteSafely(Collection<String> keys) {
        for (String key : keys) {
            try {
                // Record first so a crash between filesystem deletion and queue removal remains retryable.
                independent.executeWithoutResult(status -> jdbc.update("INSERT INTO file_cleanup_jobs(storage_key) VALUES (?) ON CONFLICT DO NOTHING", key));
            } catch (Exception error) {
                log.error("Could not persist cleanup job for storage key {}", key, error);
            }
            // Still attempt removal when the database is temporarily unavailable.
            remove(key);
        }
    }

    // Called inside the metadata transaction: rollback preserves the old files;
    // commit makes the jobs durable even if the process exits before afterCommit.
    public void recordWithinTransaction(Collection<String> keys) {
        for (String key : keys) jdbc.update("INSERT INTO file_cleanup_jobs(storage_key) VALUES (?) ON CONFLICT DO NOTHING", key);
    }

    private void remove(String key) {
        try {
            storage.delete(key);
            independent.executeWithoutResult(status -> jdbc.update("DELETE FROM file_cleanup_jobs WHERE storage_key = ?", key));
        } catch (Exception error) {
            log.warn("File cleanup deferred for storage key {}", key, error);
            try {
                independent.executeWithoutResult(status -> jdbc.update("UPDATE file_cleanup_jobs SET attempts = attempts + 1, last_error = ?, updated_at = now() WHERE storage_key = ?",
                    error.getClass().getSimpleName(), key));
            } catch (Exception queueError) { log.error("Could not update file cleanup retry", queueError); }
        }
    }

    @Scheduled(fixedDelayString = "${app.file-cleanup-delay-ms:60000}", initialDelayString = "${app.file-cleanup-delay-ms:60000}")
    public void retryPending() {
        try {
            jdbc.queryForList("SELECT storage_key FROM file_cleanup_jobs ORDER BY created_at LIMIT 100", String.class).forEach(this::remove);
        } catch (Exception error) { log.error("Could not read pending file cleanup jobs", error); }
    }
}
