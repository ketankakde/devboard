package com.devboard.auth;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import java.time.Instant;

@Document(collection = "users")
class User {
    @Id @Field("_id") @JsonProperty("id") String id;
    @Field("name")         String name;
    @Indexed(unique = true)
    @Field("email")        String email;
    @JsonIgnore
    @Field("passwordHash") String passwordHash;
    @Field("createdAt")    Instant createdAt = Instant.now();
}

@Document(collection = "api_keys")
class ApiKey {
    @Id @Field("_id") @JsonProperty("id") String id;
    @Indexed(unique = true)
    @Field("keyHash")   String keyHash;
    @Field("userId")    String userId;
    @Field("createdAt") Instant createdAt = Instant.now();
    @JsonIgnore
    @Field("revokedAt") Instant revokedAt;
}
