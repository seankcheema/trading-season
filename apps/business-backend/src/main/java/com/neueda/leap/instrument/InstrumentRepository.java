package com.neueda.leap.instrument;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for accessing Instrument entities.
 */
public interface InstrumentRepository extends JpaRepository<Instrument, Integer> {
}

