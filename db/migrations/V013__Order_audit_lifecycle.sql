-- Allow the lifecycle events written by conditional execution and cancellation.
ALTER TABLE audit_trail DROP CONSTRAINT audit_trail_event_type_check;
ALTER TABLE audit_trail ADD CONSTRAINT audit_trail_event_type_check CHECK (event_type IN
    ('PENDING','FILLED','REJECTED','SUBMITTED','ACCEPTED','APPROVED','EXECUTION_FAILED','TRIGGERED','CANCELLED'));
