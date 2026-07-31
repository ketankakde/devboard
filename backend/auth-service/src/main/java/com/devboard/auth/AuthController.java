package com.devboard.auth;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final UserRepository users;
    private final ApiKeyRepository keys;
    private final byte[] jwtSecret;
    private final BCryptPasswordEncoder bcrypt = new BCryptPasswordEncoder();

    AuthController(UserRepository users, ApiKeyRepository keys,
                   @Value("${app.jwt-secret}") String secret) {
        this.users = users;
        this.keys  = keys;
        this.jwtSecret = secret.getBytes(StandardCharsets.UTF_8);
    }

    // ── Request records ──────────────────────────────────────────────────────

    record Register(@NotBlank String name, @Email String email,
                    @Size(min = 8) String password) {}

    record Login(@Email String email, @NotBlank String password) {}

    // ── Public endpoints ─────────────────────────────────────────────────────

    @PostMapping("/register")
    ResponseEntity<?> register(@Valid @RequestBody Register r) {
        if (users.findByEmail(r.email()).isPresent())
            return ResponseEntity.status(409).body(Map.of("message", "Email already registered"));
        User u = new User();
        u.name         = r.name();
        u.email        = r.email().toLowerCase();
        u.passwordHash = bcrypt.encode(r.password());
        users.save(u);
        return ResponseEntity.status(201).body(Map.of("id", u.id, "name", u.name, "email", u.email));
    }

    @PostMapping("/login")
    ResponseEntity<?> login(@Valid @RequestBody Login r) {
        User u = users.findByEmail(r.email().toLowerCase()).orElse(null);
        if (u == null || !bcrypt.matches(r.password(), u.passwordHash))
            return ResponseEntity.status(401).body(Map.of("message", "Invalid credentials"));
        return ResponseEntity.ok(Map.of("accessToken", buildToken(u), "tokenType", "Bearer"));
    }

    @GetMapping("/me")
    ResponseEntity<?> me(@RequestHeader(value = "Authorization", required = false) String h) {
        User u = currentUser(h);
        if (u == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(Map.of("id", u.id, "name", u.name, "email", u.email));
    }

    // ── API key management ────────────────────────────────────────────────────

    @PostMapping("/api-key")
    ResponseEntity<?> generateApiKey(@RequestHeader(value = "Authorization", required = false) String h) {
        User u = currentUser(h);
        if (u == null) return ResponseEntity.status(401).build();
        String raw = "db_" + UUID.randomUUID().toString().replace("-", "")
                + UUID.randomUUID().toString().replace("-", "");
        ApiKey k = new ApiKey();
        k.userId  = u.id;
        k.keyHash = sha256(raw);
        keys.save(k);
        return ResponseEntity.status(201).body(Map.of(
                "id",        k.id,
                "apiKey",    raw,
                "createdAt", k.createdAt,
                "warning",   "Store this key securely — it is shown only once."));
    }

    @GetMapping("/api-keys")
    ResponseEntity<?> listApiKeys(@RequestHeader(value = "Authorization", required = false) String h) {
        User u = currentUser(h);
        if (u == null) return ResponseEntity.status(401).build();
        List<Map<String, Object>> result = keys.findByUserIdOrderByCreatedAtDesc(u.id).stream()
                .map(k -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id",        k.id);
                    m.put("createdAt", k.createdAt);
                    m.put("revoked",   k.revokedAt != null);
                    if (k.revokedAt != null) m.put("revokedAt", k.revokedAt);
                    return m;
                }).toList();
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/api-keys/{id}")
    ResponseEntity<?> revokeApiKey(
            @RequestHeader(value = "Authorization", required = false) String h,
            @PathVariable String id) {
        User u = currentUser(h);
        if (u == null) return ResponseEntity.status(401).build();
        ApiKey k = keys.findById(id).orElse(null);
        if (k == null || !Objects.equals(k.userId, u.id))
            return ResponseEntity.notFound().build();
        if (k.revokedAt != null)
            return ResponseEntity.status(409).body(Map.of("message", "Key already revoked"));
        k.revokedAt = Instant.now();
        keys.save(k);
        return ResponseEntity.noContent().build();
    }

    // ── Internal endpoint (called by other services via gateway-bypass) ────────

    @GetMapping("/internal/api-keys/validate")
    ResponseEntity<?> validateApiKey(
            @RequestHeader(value = "X-API-Key", required = false) String raw) {
        if (raw == null) return ResponseEntity.status(401).build();
        return keys.findByKeyHashAndRevokedAtIsNull(sha256(raw))
                .<ResponseEntity<?>>map(k -> ResponseEntity.ok(Map.of("userId", k.userId)))
                .orElseGet(() -> ResponseEntity.status(401).build());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private User currentUser(String h) {
        try {
            if (h == null || !h.startsWith("Bearer ")) return null;
            String email = Jwts.parser()
                    .verifyWith(Keys.hmacShaKeyFor(jwtSecret))
                    .build()
                    .parseSignedClaims(h.substring(7))
                    .getPayload()
                    .getSubject();
            return users.findByEmail(email).orElse(null);
        } catch (Exception e) {
            return null;
        }
    }

    private String buildToken(User u) {
        return Jwts.builder()
                .subject(u.email)
                .claim("userId", u.id)   // String ObjectId
                .issuedAt(new Date())
                .expiration(Date.from(Instant.now().plus(24, ChronoUnit.HOURS)))
                .signWith(Keys.hmacShaKeyFor(jwtSecret))
                .compact();
    }

    /** SHA-256 hex — used only for API key hashing (not passwords). */
    private String sha256(String input) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(
                            input.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
