package com.devboard.project;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.*;

// ── Documents ─────────────────────────────────────────────────────────────────

@Document(collection = "projects")
class Project {
    @Id
    @Field("_id")
    @JsonProperty("id")
    String id;

    @Field("ownerId")   String ownerId;
    @Field("title")     String title;
    @Field("description") String description;
    @Field("createdAt") Instant createdAt = Instant.now();
    @Field("updatedAt") Instant updatedAt = Instant.now();
    @JsonIgnore @Field("deletedAt") Instant deletedAt;
}

@Document(collection = "collaborators")
class Collaborator {
    @Id
    @Field("_id")
    @JsonProperty("id")
    String id;

    @Indexed @Field("projectId") String projectId;
    @Indexed @Field("userId")    String userId;
    @Field("createdAt") Instant createdAt = Instant.now();
    @JsonIgnore @Field("revokedAt") Instant revokedAt;
}

// ── Repositories ──────────────────────────────────────────────────────────────

interface ProjectRepo extends MongoRepository<Project, String> {
    List<Project> findByOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(String ownerId);
    Optional<Project> findByIdAndDeletedAtIsNull(String id);
}

interface CollaboratorRepo extends MongoRepository<Collaborator, String> {
    boolean existsByProjectIdAndUserIdAndRevokedAtIsNull(String projectId, String userId);
    List<Collaborator> findByProjectIdAndRevokedAtIsNullOrderByCreatedAtAsc(String projectId);
    Optional<Collaborator> findByProjectIdAndUserIdAndRevokedAtIsNull(String projectId, String userId);
    List<Collaborator> findByProjectIdAndRevokedAtIsNull(String projectId);
}

// ── Controller ────────────────────────────────────────────────────────────────

@RestController
@RequestMapping("/projects")
public class ProjectController {

    private final ProjectRepo      repo;
    private final CollaboratorRepo collaborators;
    private final RestClient       auth;
    private final RestClient       tasks;

    ProjectController(ProjectRepo r, CollaboratorRepo c,
                      @Value("${app.auth-url}") String authUrl,
                      @Value("${app.task-url}") String taskUrl) {
        repo          = r;
        collaborators = c;
        auth  = RestClient.builder().baseUrl(authUrl).build();
        tasks = RestClient.builder().baseUrl(taskUrl).build();
    }

    record Input(@NotBlank String title, String description) {}
    record Update(@NotBlank String title, String description) {}
    record CollaboratorInput(String userId) {}

    // ── CRUD ──────────────────────────────────────────────────────────────────

    @PostMapping
    ResponseEntity<?> create(@RequestHeader("X-API-Key") String key,
                             @Valid @RequestBody Input i) {
        String u = resolveUserId(key);
        if (u == null) return unauthorized();
        Project p = new Project();
        p.ownerId     = u;
        p.title       = i.title();
        p.description = i.description();
        repo.save(p);
        return ResponseEntity.status(201).body(p);
    }

    @GetMapping
    ResponseEntity<?> list(@RequestHeader("X-API-Key") String key) {
        String u = resolveUserId(key);
        return u == null ? unauthorized()
                : ResponseEntity.ok(repo.findByOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(u));
    }

    @GetMapping("/{id}")
    ResponseEntity<?> get(@RequestHeader("X-API-Key") String key,
                          @PathVariable String id) {
        String u  = resolveUserId(key);
        Project p = repo.findByIdAndDeletedAtIsNull(id).orElse(null);
        if (u == null) return unauthorized();
        if (p == null) return ResponseEntity.notFound().build();
        return hasAccess(u, p) ? ResponseEntity.ok(p) : forbidden();
    }

    @PutMapping("/{id}")
    ResponseEntity<?> update(@RequestHeader("X-API-Key") String key,
                             @PathVariable String id,
                             @Valid @RequestBody Update i) {
        String u  = resolveUserId(key);
        Project p = repo.findByIdAndDeletedAtIsNull(id).orElse(null);
        if (u == null) return unauthorized();
        if (p == null) return ResponseEntity.notFound().build();
        if (!isOwner(u, p)) return forbidden();
        p.title       = i.title();
        p.description = i.description();
        p.updatedAt   = Instant.now();
        return ResponseEntity.ok(repo.save(p));
    }

    @DeleteMapping("/{id}")
    ResponseEntity<?> delete(@RequestHeader("X-API-Key") String key,
                             @PathVariable String id) {
        String u  = resolveUserId(key);
        Project p = repo.findByIdAndDeletedAtIsNull(id).orElse(null);
        if (u == null) return unauthorized();
        if (p == null) return ResponseEntity.notFound().build();
        if (!isOwner(u, p)) return forbidden();
        p.deletedAt = Instant.now();
        p.updatedAt = Instant.now();
        repo.save(p);
        for (Collaborator c : collaborators.findByProjectIdAndRevokedAtIsNull(id)) {
            c.revokedAt = Instant.now();
            collaborators.save(c);
        }
        return ResponseEntity.noContent().build();
    }

    // ── Collaborators ─────────────────────────────────────────────────────────

    @PostMapping("/{id}/collaborators")
    ResponseEntity<?> addCollaborator(@RequestHeader("X-API-Key") String key,
                                      @PathVariable String id,
                                      @RequestBody CollaboratorInput input) {
        String u  = resolveUserId(key);
        Project p = repo.findByIdAndDeletedAtIsNull(id).orElse(null);
        if (u == null) return unauthorized();
        if (p == null) return ResponseEntity.notFound().build();
        if (!isOwner(u, p)) return forbidden();
        if (input.userId() == null)
            return ResponseEntity.badRequest().body(Map.of("message", "userId is required"));
        if (Objects.equals(input.userId(), p.ownerId))
            return ResponseEntity.badRequest().body(Map.of("message", "Owner is already a member"));
        if (collaborators.existsByProjectIdAndUserIdAndRevokedAtIsNull(id, input.userId()))
            return ResponseEntity.status(409).body(Map.of("message", "Collaborator already added"));
        Collaborator c = new Collaborator();
        c.projectId = id;
        c.userId    = input.userId();
        collaborators.save(c);
        return ResponseEntity.status(201).body(c);
    }

    @GetMapping("/{id}/collaborators")
    ResponseEntity<?> listCollaborators(@RequestHeader("X-API-Key") String key,
                                        @PathVariable String id) {
        String u  = resolveUserId(key);
        Project p = repo.findByIdAndDeletedAtIsNull(id).orElse(null);
        if (u == null) return unauthorized();
        if (p == null) return ResponseEntity.notFound().build();
        if (!hasAccess(u, p)) return forbidden();
        return ResponseEntity.ok(collaborators.findByProjectIdAndRevokedAtIsNullOrderByCreatedAtAsc(id));
    }

    @DeleteMapping("/{id}/collaborators/{userId}")
    ResponseEntity<?> removeCollaborator(@RequestHeader("X-API-Key") String key,
                                         @PathVariable String id,
                                         @PathVariable String userId) {
        String u  = resolveUserId(key);
        Project p = repo.findByIdAndDeletedAtIsNull(id).orElse(null);
        if (u == null) return unauthorized();
        if (p == null) return ResponseEntity.notFound().build();
        if (!isOwner(u, p)) return forbidden();
        Collaborator c = collaborators.findByProjectIdAndUserIdAndRevokedAtIsNull(id, userId).orElse(null);
        if (c == null) return ResponseEntity.notFound().build();
        c.revokedAt = Instant.now();
        collaborators.save(c);
        return ResponseEntity.noContent().build();
    }

    // ── Export ────────────────────────────────────────────────────────────────

    @GetMapping("/{id}/export")
    ResponseEntity<?> export(@RequestHeader("X-API-Key") String key,
                             @PathVariable String id) {
        String u  = resolveUserId(key);
        Project p = repo.findByIdAndDeletedAtIsNull(id).orElse(null);
        if (u == null) return unauthorized();
        if (p == null) return ResponseEntity.notFound().build();
        if (!hasAccess(u, p)) return forbidden();
        List<?> taskList;
        try {
            taskList = tasks.get()
                    .uri("/internal/projects/{id}/tasks", id)
                    .retrieve()
                    .body(List.class);
        } catch (Exception e) {
            taskList = List.of();
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("project",    p);
        out.put("tasks",      taskList);
        out.put("exportedAt", Instant.now());
        return ResponseEntity.ok(out);
    }

    // ── Internal endpoints ────────────────────────────────────────────────────

    @GetMapping("/internal/{id}/owner")
    ResponseEntity<?> owner(@PathVariable String id) {
        return repo.findByIdAndDeletedAtIsNull(id)
                .<ResponseEntity<?>>map(p -> ResponseEntity.ok(Map.of("ownerId", p.ownerId)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/internal/{id}/access/{userId}")
    ResponseEntity<?> access(@PathVariable String id, @PathVariable String userId) {
        Project p = repo.findByIdAndDeletedAtIsNull(id).orElse(null);
        if (p == null) return ResponseEntity.notFound().build();
        boolean allowed = Objects.equals(p.ownerId, userId)
                || collaborators.existsByProjectIdAndUserIdAndRevokedAtIsNull(id, userId);
        return ResponseEntity.ok(Map.of("allowed", allowed));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private boolean isOwner(String userId, Project p) {
        return Objects.equals(p.ownerId, userId);
    }

    private boolean hasAccess(String userId, Project p) {
        return isOwner(userId, p)
                || collaborators.existsByProjectIdAndUserIdAndRevokedAtIsNull(p.id, userId);
    }

    private String resolveUserId(String key) {
        try {
            Map<?, ?> m = auth.get()
                    .uri("/auth/internal/api-keys/validate")
                    .header("X-API-Key", key)
                    .retrieve()
                    .body(Map.class);
            return (String) m.get("userId");
        } catch (Exception e) {
            return null;
        }
    }

    private ResponseEntity<?> unauthorized() {
        return ResponseEntity.status(401).body(Map.of("message", "Valid X-API-Key required"));
    }

    private ResponseEntity<?> forbidden() {
        return ResponseEntity.status(403).body(Map.of("message", "Project access denied"));
    }
}
