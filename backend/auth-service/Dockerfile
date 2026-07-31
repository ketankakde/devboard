FROM --platform=linux/amd64 eclipse-temurin:21-jre-alpine
COPY auth-service/target/auth-service-1.0.0.jar /app.jar
ENTRYPOINT ["java", "-Xms64m", "-Xmx256m", "-XX:+UseSerialGC", "-jar", "/app.jar"]
