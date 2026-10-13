package com.rce.lms.file;

import com.rce.lms.common.ApiException;
import java.io.*;
import java.nio.ByteBuffer;
import java.nio.charset.*;
import java.util.*;
import javax.imageio.ImageIO;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

@Component
public class FileValidator {
    public static final long MAX_SIZE = 10L * 1024 * 1024;
    private static final Map<String, String> TYPES = Map.of(
        "pdf", "application/pdf", "md", "text/markdown", "txt", "text/plain", "zip", "application/zip",
        "png", "image/png", "jpg", "image/jpeg", "jpeg", "image/jpeg", "webp", "image/webp");

    public ValidatedFile validate(MultipartFile part, boolean profile) {
        long limit = profile ? 5L * 1024 * 1024 : MAX_SIZE;
        if (part == null || part.isEmpty()) throw invalid("빈 파일은 업로드할 수 없습니다.");
        if (part.getSize() > limit) throw tooLarge();
        String name = part.getOriginalFilename();
        if (name == null || name.isBlank() || name.length() > 200 || !name.equals(name.strip()) ||
            name.contains("/") || name.contains("\\") || name.codePoints().anyMatch(c -> Character.isISOControl(c) || Character.getType(c) == Character.FORMAT)) {
            throw invalid("파일 이름을 확인해 주세요.");
        }
        int dot = name.lastIndexOf('.');
        String extension = dot > 0 ? name.substring(dot + 1).toLowerCase(Locale.ROOT) : "";
        String type = TYPES.get(extension);
        if (type == null || (profile && !type.startsWith("image/"))) throw invalid("지원하지 않는 파일 형식입니다.");
        String declared = Optional.ofNullable(part.getContentType()).orElse("").split(";", 2)[0].strip().toLowerCase(Locale.ROOT);
        boolean compatible = declared.isEmpty() || declared.equals("application/octet-stream") || declared.equals(type)
            || (extension.equals("md") && declared.equals("text/plain"))
            || (extension.equals("zip") && declared.equals("application/x-zip-compressed"));
        if (!compatible) throw invalid("파일 확장자와 형식이 일치하지 않습니다.");
        byte[] bytes;
        try (InputStream input = part.getInputStream()) {
            bytes = input.readNBytes((int) limit + 1);
        } catch (IOException error) { throw invalid("파일을 읽을 수 없습니다."); }
        if (bytes.length == 0) throw invalid("빈 파일은 업로드할 수 없습니다.");
        if (bytes.length > limit) throw tooLarge();
        boolean valid = switch (extension) {
            case "pdf" -> starts(bytes, new byte[]{37, 80, 68, 70, 45});
            case "png" -> starts(bytes, new byte[]{(byte)137, 80, 78, 71, 13, 10, 26, 10});
            case "jpg", "jpeg" -> starts(bytes, new byte[]{(byte)255, (byte)216, (byte)255});
            case "zip" -> starts(bytes, new byte[]{80, 75, 3, 4}) || starts(bytes, new byte[]{80, 75, 5, 6}) || starts(bytes, new byte[]{80, 75, 7, 8});
            case "webp" -> bytes.length >= 12 && new String(bytes, 0, 4, StandardCharsets.US_ASCII).equals("RIFF")
                && new String(bytes, 8, 4, StandardCharsets.US_ASCII).equals("WEBP");
            default -> validText(bytes);
        };
        if (!valid) throw invalid("파일 내용과 형식이 일치하지 않습니다.");
        if (profile) validateImage(bytes);
        return new ValidatedFile(name, type, bytes);
    }

    private void validateImage(byte[] bytes) {
        try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw invalid("프로필 이미지를 PNG 또는 JPEG 형식으로 저장해 주세요.");
            var reader = readers.next();
            try {
                reader.setInput(input);
                int width = reader.getWidth(0), height = reader.getHeight(0);
                if (width != height || width < 256 || width > 4096 || reader.read(0) == null) {
                    throw invalid("프로필 이미지는 256~4096px 정사각형이어야 합니다.");
                }
            } finally { reader.dispose(); }
        } catch (IOException error) { throw invalid("유효한 이미지 파일이 아닙니다."); }
    }

    private static boolean starts(byte[] value, byte[] signature) {
        return value.length >= signature.length && Arrays.equals(Arrays.copyOf(value, signature.length), signature);
    }
    private static boolean validText(byte[] bytes) {
        for (byte value : bytes) if (value == 0) return false;
        try {
            StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes));
            return true;
        } catch (CharacterCodingException error) { return false; }
    }
    private static ApiException invalid(String message) { return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_FILE", message); }
    private static ApiException tooLarge() { return new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "파일 크기 제한을 초과했습니다."); }
}
