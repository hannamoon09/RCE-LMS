package com.rce.lms.user;

import java.nio.charset.StandardCharsets;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("dev & !test & !prod & !production")
class DevelopmentSeed implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(DevelopmentSeed.class);
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final String password;

    DevelopmentSeed(UserRepository users, PasswordEncoder encoder, @Value("${app.dev-seed-password:}") String password) {
        this.users = users;
        this.encoder = encoder;
        this.password = password;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (password.isBlank()) {
            log.info("Development seed skipped: DEV_SEED_PASSWORD is not set");
            return;
        }
        if (password.length() < 12 || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new IllegalStateException("DEV_SEED_PASSWORD must have at least 12 characters and at most 72 UTF-8 bytes");
        }
        seed("20260000", "웹해킹 운영진", Role.STAFF, Track.WEB);
        seed("20260001", "웹해킹 학습자", Role.MEMBER, Track.WEB);
        seed("20260002", "포너블 학습자", Role.MEMBER, Track.PWN);
        seed("20260003", "리버싱 학습자", Role.MEMBER, Track.REVERSING);
        seed("20260004", "포렌식 학습자", Role.MEMBER, Track.FORENSICS);
    }

    private void seed(String studentId, String name, Role role, Track track) {
        if (!users.existsByStudentId(studentId)) {
            users.save(new UserAccount(studentId, encoder.encode(password), name, role, track));
        }
    }
}
