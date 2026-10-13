package com.rce.lms;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class BootstrapIntegrationTest {
    @Autowired JdbcTemplate jdbc;

    @Test
    void startsAgainstPostgresqlWithFlyway() {
        assertThat(jdbc.queryForObject("SELECT version()", String.class)).contains("PostgreSQL");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM flyway_schema_history WHERE success", Integer.class)).isNotNull();
    }
}
