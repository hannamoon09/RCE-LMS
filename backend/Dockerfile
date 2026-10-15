FROM eclipse-temurin:21-jdk-jammy AS build
WORKDIR /workspace

COPY gradlew build.gradle settings.gradle ./
COPY gradle ./gradle
COPY src/main ./src/main
RUN chmod +x gradlew && ./gradlew --no-daemon bootJar --console=plain

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
ENV SPRING_PROFILES_ACTIVE=prod \
    SERVER_ADDRESS=0.0.0.0

COPY --from=build /workspace/build/libs/rce-lms-backend-*.jar /app/app.jar

# Railway mounts its volume as root. Keep this image's default user so the
# application can write to the runtime mount at FILE_STORAGE_PATH.
# No local .env, upload data, tests, or build credentials enter this image.
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
