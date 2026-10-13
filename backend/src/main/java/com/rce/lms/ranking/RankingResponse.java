package com.rce.lms.ranking;

import java.math.BigDecimal;

/** Identity stays private; only the current member is marked in the public ranking. */
public record RankingResponse(long rank, String name, long totalScore, BigDecimal averageScore,
                              long reviewedCount, boolean isMe) {}
