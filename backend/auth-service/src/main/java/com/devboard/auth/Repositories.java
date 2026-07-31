package com.devboard.auth;

import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.*;

interface UserRepository extends MongoRepository<User, String> {
    Optional<User> findByEmail(String email);
}

interface ApiKeyRepository extends MongoRepository<ApiKey, String> {
    Optional<ApiKey> findByKeyHashAndRevokedAtIsNull(String hash);
    List<ApiKey> findByUserIdOrderByCreatedAtDesc(String userId);
}
