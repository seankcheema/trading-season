package com.neueda.leap.order.audit;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for accessing AuditTrail entities. Insert/select only — see
 * the class-level note on {@link AuditTrail}.
 */
public interface AuditTrailRepository extends JpaRepository<AuditTrail, Integer> {
}