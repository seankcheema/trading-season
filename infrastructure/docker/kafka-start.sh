#!/bin/bash
# Starts the broker and creates the two topics, then stays up as the broker.
#
# Auto-creation is disabled on the broker, so the topics exist only because
# this script makes them. Doing it here instead of in a separate one-shot
# container means a host that runs only Kafka (the EC2 instance) needs just
# this one container, and every service can wait on the kafka healthcheck,
# which passes only once both topics exist.
#
# Depends on the apache/kafka image's own start script, /etc/kafka/docker/run,
# which ends in `exec kafka-server-start.sh`. Recheck the path and that final
# exec when the image tag changes.
set -u

BIN=/opt/kafka/bin
BOOTSTRAP=localhost:9092

/etc/kafka/docker/run &
broker=$!

# A shell running as PID 1 ignores SIGTERM unless it traps it. Pass the signal
# to the broker so `docker stop` shuts it down cleanly instead of waiting for
# the kill timeout, then exit with the broker's own status.
stop() {
    kill -TERM "$broker" 2>/dev/null
    wait "$broker"
    exit $?
}
trap stop TERM INT

# A real API call rather than a port check: the listener socket binds before
# the broker serves requests.
until "$BIN/kafka-broker-api-versions.sh" --bootstrap-server "$BOOTSTRAP" >/dev/null 2>&1; do
    if ! kill -0 "$broker" 2>/dev/null; then
        wait "$broker"
        exit $?
    fi
    sleep 2
done

# Three partitions is a decision, not a default. Kafka guarantees order only
# within a partition, and the pipeline design depends on the account id keying
# all of one account's events to one partition. The count can be raised later
# but never safely lowered, and raising it re-hashes keys, so events already
# written and events written afterwards would land in different partitions for
# the same account. --if-not-exists makes a rerun a no-op rather than an error.
#
# trade-events is kept forever (retention.ms=-1). The reporting service keeps
# its copy on local disk, which a replaced ECS task loses, and rebuilds it by
# replaying this topic, so anything the broker deleted would be gone from
# reporting for good.
#
# platform-records is compacted, not time-limited. Each message is the current
# state of one row, keyed by its type and id, so the topic never needs more
# than the latest message per key, and keeps that for good: the reporting
# service, which has no database, can always be rebuilt from it.
create_topics() {
    "$BIN/kafka-topics.sh" --bootstrap-server "$BOOTSTRAP" \
        --create --if-not-exists --topic trade-events \
        --partitions 3 --replication-factor 1 \
        --config retention.ms=-1 &&
    "$BIN/kafka-topics.sh" --bootstrap-server "$BOOTSTRAP" \
        --create --if-not-exists --topic platform-records \
        --partitions 3 --replication-factor 1 \
        --config cleanup.policy=compact
}

if ! create_topics; then
    echo "Creating the Kafka topics failed; stopping the broker." >&2
    kill -TERM "$broker" 2>/dev/null
    wait "$broker"
    exit 1
fi
echo "Kafka topics trade-events and platform-records are in place."

wait "$broker"
exit $?
