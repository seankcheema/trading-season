package com.neueda.leap.instrument;

/** No instrument exists for the given instrument id. */
public class InstrumentNotFoundException extends RuntimeException {

    public InstrumentNotFoundException(Integer instrumentId) {
        super("No instrument exists for the given instrument id: " + instrumentId);
    }

    public InstrumentNotFoundException(String message) {
        super(message);
    }

}
