package com.rce.lms;

import static org.assertj.core.api.Assertions.*;

import com.rce.lms.file.LocalFileStorage;
import com.rce.lms.file.ValidatedFile;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class LocalFileStorageTest {
    @TempDir Path temporary;

    @Test
    void createsPrivateUuidKeysAndRoundTripsOriginalBytesWithoutExposingDisplayNames() throws Exception {
        Path root = temporary.resolve("private/uploads");
        var storage = new LocalFileStorage(root.toString());
        byte[] bytes = "동일한 원본 파일 내용\n".getBytes(StandardCharsets.UTF_8);
        var upload = storage.save(new ValidatedFile("보고서.txt", "text/plain", bytes));
        var duplicateName = storage.save(new ValidatedFile("보고서.txt", "text/plain", bytes));
        assertThat(UUID.fromString(upload.storageKey()).toString()).isEqualTo(upload.storageKey());
        assertThat(duplicateName.storageKey()).isNotEqualTo(upload.storageKey());
        assertThat(upload.fileName()).isEqualTo("보고서.txt");
        assertThat(upload.contentType()).isEqualTo("text/plain");
        assertThat(upload.size()).isEqualTo(bytes.length);
        try (var stream = storage.load(upload.storageKey()).getInputStream()) {
            assertThat(stream.readAllBytes()).containsExactly(bytes);
        }
        try (var children = Files.list(root)) {
            assertThat(children.map(path -> path.getFileName().toString()).toList())
                .containsExactlyInAnyOrder(upload.storageKey(), duplicateName.storageKey());
        }
        storage.delete(upload.storageKey());
        storage.delete(upload.storageKey());
        assertThatThrownBy(() -> storage.load(upload.storageKey())).isInstanceOf(IOException.class);
        assertThat(Files.exists(root.resolve(duplicateName.storageKey()))).isTrue();
    }

    @Test
    void rejectsTraversalAbsolutePathsDisplayNamesAndNonCanonicalKeys() throws Exception {
        var storage = new LocalFileStorage(temporary.resolve("uploads").toString());
        for (String key : Arrays.asList(null, "", "../outside.txt", "/etc/passwd", "C:\\outside.txt", "report.txt",
                UUID.randomUUID().toString().toUpperCase(), UUID.randomUUID() + "/suffix")) {
            assertThatThrownBy(() -> storage.load(key)).isInstanceOf(IOException.class);
            assertThatThrownBy(() -> storage.delete(key)).isInstanceOf(IOException.class);
        }
    }

    @Test
    void refusesSymbolicLinksForBothReadsAndDeletesAndLeavesTheTargetUntouched() throws Exception {
        Path root = temporary.resolve("uploads");
        var storage = new LocalFileStorage(root.toString());
        Path outside = temporary.resolve("outside-secret.txt");
        Files.writeString(outside, "private outside data");
        String key = UUID.randomUUID().toString();
        Path link = root.resolve(key);
        Files.createSymbolicLink(link, outside);
        assertThatThrownBy(() -> storage.load(key)).isInstanceOf(IOException.class);
        assertThatThrownBy(() -> storage.delete(key)).isInstanceOf(IOException.class);
        assertThat(Files.readString(outside)).isEqualTo("private outside data");
        assertThat(Files.isSymbolicLink(link)).isTrue();
        String directoryKey = UUID.randomUUID().toString();
        Files.createDirectory(root.resolve(directoryKey));
        assertThatThrownBy(() -> storage.load(directoryKey)).isInstanceOf(IOException.class);
    }
}
