"""
Container entry point: the web service and the consumer in one container.

Runs gunicorn and consumer.py as two child processes and keeps them together.
They are separate processes because gunicorn runs several workers and the
consumer must run exactly once: two writers must never append to the same
partition file, and the report job must run once, not once per worker.

Either child exiting ends the container. A web service that outlives its
consumer would quietly serve files that stop growing, so the pair goes down
together and the container's restart policy brings both back. SIGTERM and
SIGINT are passed to both children, which get GRACE_SECONDS to finish, so a
report run in flight is not cut off.
"""

import logging
import signal
import subprocess
import sys
import threading

logger = logging.getLogger('serve')

# Matches stop_grace_period in Compose; a longer ECS stopTimeout is fine.
GRACE_SECONDS = 20
POLL_SECONDS = 0.5

GUNICORN = ['gunicorn', '--bind', '0.0.0.0:8083', '--workers', '4', '--threads', '2',
            '--worker-class', 'gthread', '--timeout', '60', '--access-logfile', '-',
            '--error-logfile', '-', 'wsgi:app']
CONSUMER = [sys.executable, 'consumer.py']


def supervise(commands, stop, popen=subprocess.Popen, grace=GRACE_SECONDS, poll=POLL_SECONDS):
    """
    Start every command and wait until stop is set or one of them exits, then
    stop the rest. Returns the exit status for the container: 0 when asked to
    stop, otherwise the status of the child that exited first, never 0, since
    a child that quits on its own has failed whatever its status says.
    """
    children = [popen(command) for command in commands]
    status = 0
    try:
        while not stop.is_set():
            exited = [child for child in children if child.poll() is not None]
            if exited:
                status = _container_status(exited[0].returncode)
                logger.error('%s exited with status %s; stopping the container', exited[0].args, exited[0].returncode)
                break
            stop.wait(poll)
    finally:
        _terminate(children, grace)
    return status


def _container_status(returncode):
    """A child's exit status as a container status: 128 plus the signal if it was killed, and never 0."""
    return 128 - returncode if returncode < 0 else returncode or 1


def _terminate(children, grace):
    """SIGTERM every running child, then SIGKILL whichever is still running after the grace period."""
    for child in children:
        if child.poll() is None:
            child.terminate()
    for child in children:
        try:
            child.wait(timeout=grace)
        except subprocess.TimeoutExpired:
            logger.error('%s ignored SIGTERM for %s seconds; killing it', child.args, grace)
            child.kill()
            child.wait()


def main():
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s %(message)s')
    stop = threading.Event()
    for signum in (signal.SIGTERM, signal.SIGINT):
        signal.signal(signum, lambda *_: stop.set())
    return supervise([CONSUMER, GUNICORN], stop)


if __name__ == '__main__':  # pragma: no cover - the container entry point
    sys.exit(main())
