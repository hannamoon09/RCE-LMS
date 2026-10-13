package com.rce.lms.file;

import java.io.IOException;
import java.nio.file.*;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.PathResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

@Component
public class LocalFileStorage implements FileStorage {
    private final Path root;

    public LocalFileStorage(@Value("${app.file-storage-path}") String directory) throws IOException {
        Path configured = Path.of(directory).toAbsolutePath().normalize();
        Files.createDirectories(configured);
        root = configured.toRealPath();
    }

    private Path resolve(String key) throws IOException {
        if (key == null || !key.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")) {
            throw new IOException("Invalid storage key");
        }
        Path path = root.resolve(key);
        if (Files.isSymbolicLink(path)) throw new IOException("Symbolic file links are forbidden");
        return path;
    }

    @Override
    public StoredUpload save(ValidatedFile file) throws IOException {
        String key = UUID.randomUUID().toString();
        Path temporary = Files.createTempFile(root, ".upload-", ".tmp");
        try {
            Files.write(temporary, file.bytes());
            try {
                Files.move(temporary, resolve(key), StandardCopyOption.ATOMIC_MOVE);
            } catch (AtomicMoveNotSupportedException error) {
                Files.move(temporary, resolve(key));
            }
            return new StoredUpload(key, file.fileName(), file.contentType(), file.bytes().length);
        } finally {
            Files.deleteIfExists(temporary);
        }
    }

    @Override
    public Resource load(String key) throws IOException {
        Path path = resolve(key);
        if (!Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)) throw new NoSuchFileException("Stored file unavailable");
        return new PathResource(path);
    }

    @Override
    public void delete(String key) throws IOException { Files.deleteIfExists(resolve(key)); }
}
