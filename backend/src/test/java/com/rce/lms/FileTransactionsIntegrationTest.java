package com.rce.lms;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.rce.lms.common.ApiException;
import com.rce.lms.file.*;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest(properties = "app.file-cleanup-delay-ms=86400000")
@ActiveProfiles("test")
class FileTransactionsIntegrationTest {
    @Autowired FileTransactions files;
    @Autowired FileCleanup cleanup;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean FileStorage storage;
    private final List<UUID> userIds = new ArrayList<>();
    private final List<String> storageKeys = new ArrayList<>();

    @AfterEach
    void removeFixtures() {
        for (UUID id : userIds) jdbc.update("DELETE FROM users WHERE id = ?", id);
        for (String key : storageKeys) jdbc.update("DELETE FROM file_cleanup_jobs WHERE storage_key = ?", key);
    }

    @Test
    void databaseRollbackRemovesNewlySavedFilesButPreservesOldFiles() throws Exception {
        String newKey = key(), oldKey = key();
        when(storage.save(any())).thenReturn(stored(newKey));
        UUID userId = userId();
        assertThatThrownBy(() -> files.replace(List.of(upload("new.txt")), false, saved -> {
            insertUser(userId);
            files.deleteAfterCommit(List.of(oldKey));
            assertThat(saved).extracting(StoredUpload::storageKey).containsExactly(newKey);
            throw new IllegalStateException("Simulated database operation failure");
        })).isInstanceOf(IllegalStateException.class).hasMessage("Simulated database operation failure");
        assertThat(userExists(userId)).isFalse();
        verify(storage).delete(newKey);
        verify(storage, never()).delete(oldKey);
        assertThat(jobCount(newKey)).isZero();
        assertThat(jobCount(oldKey)).isZero();
    }

    @Test
    void failureDuringTheSecondSaveCleansTheFirstAndNeverRunsDatabaseWork() throws Exception {
        String firstKey = key();
        when(storage.save(any())).thenReturn(stored(firstKey)).thenThrow(new IOException("Disk full"));
        AtomicBoolean actionCalled = new AtomicBoolean();
        assertThatThrownBy(() -> files.replace(List.of(upload("first.txt"), upload("second.txt")), false, saved -> {
            actionCalled.set(true);
            return null;
        })).isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.getCode()).isEqualTo("FILE_STORAGE_ERROR"));
        assertThat(actionCalled).isFalse();
        verify(storage, times(2)).save(any());
        verify(storage).delete(firstKey);
        assertThat(jobCount(firstKey)).isZero();
    }

    @Test
    void afterCommitDeleteFailureKeepsTheCommittedDatabaseAndNewFileAndRetriesFromTheQueue() throws Exception {
        String newKey = key(), oldKey = key();
        when(storage.save(any())).thenReturn(stored(newKey));
        doThrow(new IOException("Temporarily unavailable")).doNothing().when(storage).delete(oldKey);
        UUID userId = userId();
        UUID result = files.replace(List.of(upload("new.txt")), false, saved -> {
            insertUser(userId);
            files.deleteAfterCommit(List.of(oldKey));
            assertThatNoException().isThrownBy(() -> verify(storage, never()).delete(oldKey));
            return userId;
        });
        assertThat(result).isEqualTo(userId);
        assertThat(userExists(userId)).isTrue();
        verify(storage, never()).delete(newKey);
        assertThat(jobCount(oldKey)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT attempts FROM file_cleanup_jobs WHERE storage_key = ?", Integer.class, oldKey)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT last_error FROM file_cleanup_jobs WHERE storage_key = ?", String.class, oldKey)).isEqualTo("IOException");
        cleanup.retryPending();
        verify(storage, times(2)).delete(oldKey);
        assertThat(jobCount(oldKey)).isZero();
        assertThat(userExists(userId)).isTrue();
    }

    @Test
    void failedCleanupAfterRollbackIsQueuedAndRetriedWithoutRestoringTheRolledBackDatabase() throws Exception {
        String newKey = key();
        when(storage.save(any())).thenReturn(stored(newKey));
        doThrow(new IOException("Temporarily unavailable")).doNothing().when(storage).delete(newKey);
        UUID userId = userId();
        assertThatThrownBy(() -> files.replace(List.of(upload("new.txt")), false, saved -> {
            insertUser(userId);
            throw new IllegalStateException("Rollback");
        })).isInstanceOf(IllegalStateException.class).hasMessage("Rollback");
        assertThat(userExists(userId)).isFalse();
        assertThat(jobCount(newKey)).isEqualTo(1);
        cleanup.retryPending();
        verify(storage, times(2)).delete(newKey);
        assertThat(jobCount(newKey)).isZero();
        assertThat(userExists(userId)).isFalse();
    }

    private UUID userId() {
        UUID id = UUID.randomUUID();
        userIds.add(id);
        return id;
    }

    private void insertUser(UUID id) {
        jdbc.update("INSERT INTO users(id, student_id, password_hash, name, role, track, active, joined_at) VALUES (?, ?, ?, ?, 'MEMBER', 'WEB', true, now())",
            id, id.toString().replace("-", ""), "Unused test-only hash", "파일 트랜잭션 테스트");
    }

    private boolean userExists(UUID id) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE id = ?", Integer.class, id) == 1;
    }

    private String key() {
        String key = UUID.randomUUID().toString();
        storageKeys.add(key);
        return key;
    }

    private int jobCount(String key) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM file_cleanup_jobs WHERE storage_key = ?", Integer.class, key);
    }

    private static StoredUpload stored(String key) { return new StoredUpload(key, "new.txt", "text/plain", 4); }

    private static MockMultipartFile upload(String name) {
        return new MockMultipartFile("files", name, "text/plain", "data".getBytes(StandardCharsets.UTF_8));
    }
}
