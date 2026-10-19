"""The container supervisor, with fake child processes."""

import signal
import subprocess
import threading

import serve


class FakeChild:
    """Looks like a subprocess.Popen for the parts the supervisor uses."""

    def __init__(self, args, returncode=None, ignores_sigterm=False):
        self.args = args
        self.returncode = returncode
        self.ignores_sigterm = ignores_sigterm
        self.terminated = False
        self.killed = False

    def poll(self):
        return self.returncode

    def terminate(self):
        self.terminated = True
        if not self.ignores_sigterm:
            self.returncode = 0

    def kill(self):
        self.killed = True
        self.returncode = -9

    def wait(self, timeout=None):
        if self.returncode is None:
            raise subprocess.TimeoutExpired(self.args, timeout)
        return self.returncode


def launcher(*children):
    """A popen that hands out the given children in the order the commands are started."""
    started = list(children)
    return lambda command: started.pop(0)


class TestSupervise:

    def test_a_stop_request_terminates_both_children_and_exits_cleanly(self):
        consumer, web = FakeChild('consumer'), FakeChild('web')
        stop = threading.Event()
        stop.set()

        status = serve.supervise(['consumer', 'web'], stop, popen=launcher(consumer, web), grace=1)

        assert status == 0
        assert consumer.terminated and web.terminated
        assert not consumer.killed and not web.killed

    def test_a_child_that_ignores_sigterm_is_killed_after_the_grace_period(self):
        consumer, web = FakeChild('consumer', ignores_sigterm=True), FakeChild('web')
        stop = threading.Event()
        stop.set()

        serve.supervise(['consumer', 'web'], stop, popen=launcher(consumer, web), grace=0)

        assert consumer.killed
        assert not web.killed

    def test_the_consumer_exiting_stops_the_web_service_and_returns_its_status(self):
        consumer, web = FakeChild('consumer', returncode=3), FakeChild('web')

        status = serve.supervise(['consumer', 'web'], threading.Event(), popen=launcher(consumer, web), poll=0)

        assert status == 3
        assert web.terminated, 'a web service must not outlive its consumer'
        assert not consumer.terminated, 'it had already exited'

    def test_a_child_killed_by_a_signal_reports_128_plus_the_signal(self):
        consumer, web = FakeChild('consumer', returncode=-9), FakeChild('web')

        status = serve.supervise(['consumer', 'web'], threading.Event(), popen=launcher(consumer, web), poll=0)

        assert status == 137

    def test_the_web_service_exiting_stops_the_consumer(self):
        consumer, web = FakeChild('consumer'), FakeChild('web', returncode=1)

        status = serve.supervise(['consumer', 'web'], threading.Event(), popen=launcher(consumer, web), poll=0)

        assert status == 1
        assert consumer.terminated

    def test_a_child_that_exits_with_status_zero_still_fails_the_container(self):
        consumer, web = FakeChild('consumer', returncode=0), FakeChild('web')

        status = serve.supervise(['consumer', 'web'], threading.Event(), popen=launcher(consumer, web), poll=0)

        assert status == 1, 'the container restarts only on a non-zero status'
        assert web.terminated

    def test_the_stop_request_arrives_while_both_children_are_running(self):
        consumer, web = FakeChild('consumer'), FakeChild('web')
        stop = threading.Event()
        threading.Timer(0.05, stop.set).start()

        status = serve.supervise(['consumer', 'web'], stop, popen=launcher(consumer, web), poll=0.01, grace=1)

        assert status == 0
        assert consumer.terminated and web.terminated


class TestCommands:

    def test_the_consumer_is_the_same_script_the_local_scripts_run(self):
        assert serve.CONSUMER[1:] == ['consumer.py']

    def test_gunicorn_serves_the_wsgi_app_on_the_port_the_health_check_probes(self):
        assert serve.GUNICORN[0] == 'gunicorn'
        assert serve.GUNICORN[-1] == 'wsgi:app'
        assert serve.GUNICORN[serve.GUNICORN.index('--bind') + 1] == '0.0.0.0:8083'


class TestMain:

    def test_runs_the_consumer_and_the_web_service_and_stops_on_sigterm_and_sigint(self, mocker):
        handlers = {}
        mocker.patch('serve.signal.signal', side_effect=lambda signum, handler: handlers.__setitem__(signum, handler))
        supervise = mocker.patch('serve.supervise', return_value=0)

        assert serve.main() == 0

        commands, stop = supervise.call_args.args
        assert commands == [serve.CONSUMER, serve.GUNICORN]
        assert set(handlers) == {signal.SIGTERM, signal.SIGINT}
        assert not stop.is_set()
        handlers[signal.SIGTERM]()
        assert stop.is_set()
