FROM --platform=linux/amd64 eclipse-temurin:21-jre-alpine
COPY project-service/target/project-service-1.0.0.jar /app.jar
ENTRYPOINT ["java", "-Xms64m", "-Xmx256m", "-XX:+UseSerialGC", "-jar", "/app.jar"]
