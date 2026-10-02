"""Bounded thread execution for native calls; cancellation cannot stop running work."""
import asyncio
from concurrent.futures import ThreadPoolExecutor

from digital_twin.contracts.orbit import OrbitBusy

class BoundedOrbitExecutor:
    def __init__(self,*,workers,waiting_requests):
        if type(workers) is not int or workers<1 or type(waiting_requests) is not int or waiting_requests<0:raise ValueError('invalid executor bounds')
        self._pool=ThreadPoolExecutor(max_workers=workers,thread_name_prefix='orbit-calculation')
        self._limit=workers+waiting_requests
        self._inflight=0;self._closed=False;self._loop=None
    async def run(self,calculate):
        if self._closed:raise OrbitBusy('orbit executor closed')
        loop=asyncio.get_running_loop()
        if self._loop is None:self._loop=loop
        elif self._loop is not loop:raise RuntimeError('orbit executor used across event loops')
        if self._inflight>=self._limit:raise OrbitBusy('orbit calculation queue full')
        self._inflight+=1
        try:future=self._pool.submit(calculate)
        except BaseException:
            self._inflight-=1;raise
        wrapped=asyncio.wrap_future(future,loop=loop)
        released=False
        def finished(done):
            nonlocal released
            if not released:
                released=True
                self._inflight-=1
            if done.done() and not done.cancelled():done.exception()
        wrapped.add_done_callback(finished)
        try:return await asyncio.shield(wrapped)
        except asyncio.CancelledError:
            future.cancel() # succeeds only for a queued, not running, call
            raise
        finally:
            # An already completed future can be awaited before its callback runs.
            if future.done():finished(wrapped)
    async def close(self):
        if not self._closed:
            self._closed=True
            await asyncio.to_thread(self._pool.shutdown,wait=True,cancel_futures=True)
