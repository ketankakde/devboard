package com.devboard.task;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.annotation.Id;
import org.springframework.data.domain.*;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;

import java.time.*;
import java.util.*;

// ── Enums ─────────────────────────────────────────────────────────────────────

enum Status   { TODO, IN_PROGRESS, DONE }
enum Priority { LOW, MEDIUM, HIGH }

// ── Document ──────────────────────────────────────────────────────────────────

@Document(collection = "tasks")
class Task {
    @Id
    @Field("_id")
    @JsonProperty("id")
    String id;

    @Field("projectId")   String    projectId;
    @Field("title")       String    title;
    @Field("description") String    description;
    @Field("status")      Status    status   = Status.TODO;
    @Field("priority")    Priority  priority = Priority.MEDIUM;
    @Field("dueDate")     LocalDate dueDate;
    @Field("createdAt")   Instant   createdAt = Instant.now();
    @Field("updatedAt")   Instant   updatedAt = Instant.now();
    @JsonIgnore @Field("deletedAt") Instant deletedAt;
}

// ── Repository ────────────────────────────────────────────────────────────────

interface TaskRepo extends MongoRepository<Task, String> {
    Page<Task>         findByProjectIdAndDeletedAtIsNullOrderByCreatedAtDesc(String projectId, Pageable p);
    Optional<Task>     findByIdAndDeletedAtIsNull(String id);
    List<Task>         findByProjectIdAndDeletedAtIsNullOrderByCreatedAtDesc(String projectId);
}

// ── Controller ────────────────────────────────────────────────────────────────

@RestController
public class TaskController {

    private final TaskRepo   repo;
    private final RestClient auth;
    private final RestClient projects;

    TaskController(TaskRepo r,
                   @Value("${app.auth-url}")    String a,
                   @Value("${app.project-url}") String p) {
        repo     = r;
        auth     = RestClient.builder().baseUrl(a).build();
        projects = RestClient.builder().baseUrl(p).build();
    }

    record Create(@NotBlank String title, String description,
                  Priority priority, LocalDate dueDate) {}

    record Update(@NotBlank String title, String description,
                  Status status, Priority priority, LocalDate dueDate) {}

    // ── Endpoints ─────────────────────────────────────────────────────────────

    @PostMapping("/projects/{projectId}/tasks")
    ResponseEntity<?> create(@RequestHeader("X-API-Key") String k,
                             @PathVariable String projectId,
                             @Valid @RequestBody Create i) {
        String u = user(k);
        if (u == null) return unauthorized();
        if (!hasAccess(u, projectId)) return forbidden();
        Task t = new Task();
        t.projectId   = projectId;
        t.title       = i.title();
        t.description = i.description();
        if (i.priority() != null) t.priority = i.priority();
        t.dueDate = i.dueDate();
        return ResponseEntity.status(201).body(repo.save(t));
    }

    @GetMapping("/projects/{projectId}/tasks")
    ResponseEntity<?> list(@RequestHeader("X-API-Key") String k,
                           @PathVariable String projectId,
                           @RequestParam(defaultValue = "0")  @Min(0)          int page,
                           @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        String u = user(k);
        if (u == null) return unauthorized();
        if (!hasAccess(u, projectId)) return forbidden();
        return ResponseEntity.ok(
                repo.findByProjectIdAndDeletedAtIsNullOrderByCreatedAtDesc(
                        projectId, PageRequest.of(page, size)));
    }

    @PutMapping("/tasks/{id}")
    ResponseEntity<?> update(@RequestHeader("X-API-Key") String k,
                             @PathVariable String id,
                             @Valid @RequestBody Update i) {
        Task t = repo.findByIdAndDeletedAtIsNull(id).orElse(null);
        if (t == null) return ResponseEntity.notFound().build();
        String u = user(k);
        if (u == null) return unauthorized();
        if (!hasAccess(u, t.projectId)) return forbidden();
        t.title       = i.title();
        t.description = i.description();
        if (i.status()   != null) t.status   = i.status();
        if (i.priority() != null) t.priority = i.priority();
        t.dueDate   = i.dueDate();
        t.updatedAt = Instant.now();
        return ResponseEntity.ok(repo.save(t));
    }

    @DeleteMapping("/tasks/{id}")
    ResponseEntity<?> delete(@RequestHeader("X-API-Key") String k,
                             @PathVariable String id) {
        Task t = repo.findByIdAndDeletedAtIsNull(id).orElse(null);
        if (t == null) return ResponseEntity.notFound().build();
        String u = user(k);
        if (u == null) return unauthorized();
        if (!hasAccess(u, t.projectId)) return forbidden();
        t.deletedAt = Instant.now();
        t.updatedAt = Instant.now();
        repo.save(t);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/internal/projects/{projectId}/tasks")
    ResponseEntity<?> internalList(@PathVariable String projectId) {
        return ResponseEntity.ok(
                repo.findByProjectIdAndDeletedAtIsNullOrderByCreatedAtDesc(projectId));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private boolean hasAccess(String userId, String projectId) {
        try {
            Map<?, ?> m = projects.get()
                    .uri("/projects/internal/{id}/access/{userId}", projectId, userId)
                    .retrieve()
                    .body(Map.class);
            return Boolean.TRUE.equals(m == null ? null : m.get("allowed"));
        } catch (Exception e) {
            return false;
        }
    }

    private String user(String k) {
        try {
            Map<?, ?> m = auth.get()
                    .uri("/auth/internal/api-keys/validate")
                    .header("X-API-Key", k)
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
