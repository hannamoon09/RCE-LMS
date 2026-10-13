package com.rce.lms;

import static org.assertj.core.api.Assertions.*;

import com.rce.lms.common.ApiException;
import com.rce.lms.file.FileValidator;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;

class FileValidatorTest {
    private final FileValidator validator = new FileValidator();

    @Test
    void supportedAttachmentsKeepTheirDisplayNameAndUseCanonicalContentTypes() throws Exception {
        record Example(String name, String declared, String expected, byte[] bytes) {}
        List<Example> examples = List.of(
            new Example("보고서.PDF", "application/pdf", "application/pdf", ascii("%PDF-1.7\nreport")),
            new Example("보고서.md", "text/plain; charset=UTF-8", "text/markdown", "# 한글 보고서\n".getBytes(StandardCharsets.UTF_8)),
            new Example("notes.txt", null, "text/plain", ascii("line one\nline two\tend")),
            new Example("archive.zip", "application/x-zip-compressed", "application/zip", new byte[]{80, 75, 5, 6, 0, 0}),
            new Example("capture.png", "application/octet-stream", "image/png", image("png", 16, 16)),
            new Example("capture.jpg", "image/jpeg", "image/jpeg", image("jpeg", 16, 16)),
            new Example("capture.jpeg", "image/jpeg", "image/jpeg", image("jpeg", 16, 16)),
            new Example("capture.webp", "image/webp", "image/webp", new byte[]{82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80})
        );
        for (Example example : examples) {
            var result = validator.validate(part(example.name(), example.declared(), example.bytes()), false);
            assertThat(result.fileName()).isEqualTo(example.name());
            assertThat(result.contentType()).isEqualTo(example.expected());
            assertThat(result.bytes()).containsExactly(example.bytes());
        }
    }

    @Test
    void extensionMimeAndSignatureMustAgree() {
        List<MockMultipartFile> invalid = List.of(
            part("report.exe", "application/octet-stream", ascii("payload")),
            part("report.pdf", "image/png", ascii("%PDF-1.7")),
            part("report.png", "image/png", ascii("%PDF-1.7")),
            part("report.pdf", "application/pdf", ascii("not a PDF")),
            part("report.zip", "application/zip", ascii("not an archive")),
            part("report.jpg", "image/jpeg", ascii("not a JPEG")),
            part("report.webp", "image/webp", ascii("RIFF0000WAVE"))
        );
        for (var file : invalid) assertInvalid(file, false);
    }

    @Test
    void rejectsTraversalMissingNamesAndInvisibleFilenameCharacters() {
        for (String name : List.of("../report.txt", "folder/report.txt", "C:\\report.txt", ".txt", "report",
                " report.txt", "report.txt ", "report\r\n.txt", "report\u0000.txt", "report\u202Etxt.txt", "x".repeat(197) + ".txt")) {
            assertInvalid(part(name, "text/plain", ascii("report")), false);
        }
        assertInvalid(part(null, "text/plain", ascii("report")), false);
        assertInvalid(part("", "text/plain", ascii("report")), false);
    }

    @Test
    void rejectsEmptyBinaryTextAndMalformedUtf8ButAcceptsUnicodeText() {
        assertInvalid(null, false);
        assertInvalid(part("empty.txt", "text/plain", new byte[0]), false);
        assertInvalid(part("nul.txt", "text/plain", new byte[]{65, 0, 66}), false);
        assertInvalid(part("bad.txt", "text/plain", new byte[]{(byte) 0xC3, 0x28}), false);
        byte[] unicode = "한글 보고서 / 日本語 / 🔒\n".getBytes(StandardCharsets.UTF_8);
        assertThat(validator.validate(part("한글 보고서.txt", "text/plain", unicode), false).bytes()).containsExactly(unicode);
    }

    @Test
    void enforcesSizeUsingBothReportedLengthAndTheActualInputStream() {
        var reportedTooLarge = new MockMultipartFile("files", "large.txt", "text/plain", ascii("small")) {
            @Override public long getSize() { return FileValidator.MAX_SIZE + 1; }
        };
        assertTooLarge(reportedTooLarge, false);
        byte[] oversized = new byte[(int) FileValidator.MAX_SIZE + 1];
        var understated = new MockMultipartFile("files", "large.txt", "text/plain", oversized) {
            @Override public long getSize() { return 1; }
        };
        assertTooLarge(understated, false);
        var profileTooLarge = new MockMultipartFile("files", "avatar.png", "image/png", ascii("small")) {
            @Override public long getSize() { return 5L * 1024 * 1024 + 1; }
        };
        assertTooLarge(profileTooLarge, true);
    }

    @Test
    void validatesDecodedProfileCropsAndRejectsSmallNonSquareOrBrokenImages() throws Exception {
        var cropped = part("profile.png", "image/png", image("png", 512, 512));
        assertThat(validator.validate(cropped, true).contentType()).isEqualTo("image/png");
        assertThat(validator.validate(part("profile.jpeg", "image/jpeg", image("jpeg", 256, 256)), true).contentType()).isEqualTo("image/jpeg");
        assertInvalid(part("small.png", "image/png", image("png", 255, 255)), true);
        assertInvalid(part("rectangle.png", "image/png", image("png", 512, 256)), true);
        assertInvalid(part("huge.png", "image/png", image("png", 4097, 4097)), true);
        assertInvalid(part("broken.png", "image/png", new byte[]{(byte) 137, 80, 78, 71, 13, 10, 26, 10}), true);
        assertInvalid(part("profile.txt", "text/plain", ascii("not an image")), true);
    }

    private void assertInvalid(MockMultipartFile part, boolean profile) {
        assertThatThrownBy(() -> validator.validate(part, profile)).isInstanceOfSatisfying(ApiException.class, error -> {
            assertThat(error.getCode()).isEqualTo("INVALID_FILE");
            assertThat(error.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
        });
    }

    private void assertTooLarge(MockMultipartFile part, boolean profile) {
        assertThatThrownBy(() -> validator.validate(part, profile)).isInstanceOfSatisfying(ApiException.class, error -> {
            assertThat(error.getCode()).isEqualTo("FILE_TOO_LARGE");
            assertThat(error.getStatus()).isEqualTo(HttpStatus.PAYLOAD_TOO_LARGE);
        });
    }

    private static MockMultipartFile part(String name, String contentType, byte[] bytes) {
        return new MockMultipartFile("files", name, contentType, bytes);
    }

    private static byte[] ascii(String text) { return text.getBytes(StandardCharsets.US_ASCII); }

    private static byte[] image(String format, int width, int height) throws Exception {
        var output = new ByteArrayOutputStream();
        assertThat(ImageIO.write(new BufferedImage(width, height, BufferedImage.TYPE_BYTE_GRAY), format, output)).isTrue();
        return output.toByteArray();
    }
}
