package app.order.event;

import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * An emitter that records what it would have written instead of needing a
 * servlet response. Each frame is the wire text of one event, so tests can
 * assert on the event name and body together.
 */
class RecordingSseEmitter extends SseEmitter {

    private final List<String> frames = new CopyOnWriteArrayList<>();
    private final boolean failOnSend;

    RecordingSseEmitter() {
        this(false);
    }

    RecordingSseEmitter(boolean failOnSend) {
        super(0L);
        this.failOnSend = failOnSend;
    }

    @Override
    public void send(SseEventBuilder builder) throws IOException {
        if (failOnSend) {
            throw new IOException("client went away");
        }
        StringBuilder frame = new StringBuilder();
        builder.build().forEach(part -> frame.append(part.getData()));
        frames.add(frame.toString());
    }

    List<String> frames() {
        return frames;
    }

    List<String> framesNamed(String eventName) {
        return frames.stream().filter(frame -> frame.contains("event:" + eventName)).toList();
    }
}
