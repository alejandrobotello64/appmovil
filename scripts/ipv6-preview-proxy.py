#!/usr/bin/env python3
"""Forward [::1]:43145 to 127.0.0.1:43145 for Preview proxies that prefer IPv6."""

from __future__ import annotations

import select
import socket
import threading

LISTEN = ("::1", 43145)
TARGET = ("127.0.0.1", 43145)


def pipe(left: socket.socket, right: socket.socket) -> None:
    try:
        while True:
            ready, _, _ = select.select([left, right], [], [], 120)
            if not ready:
                continue
            for src in ready:
                data = src.recv(65536)
                if not data:
                    return
                (right if src is left else left).sendall(data)
    except OSError:
        pass
    finally:
        for sock in (left, right):
            try:
                sock.close()
            except OSError:
                pass


def main() -> None:
    server = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 1)
    server.bind(LISTEN)
    server.listen(128)
    print("IPv6 preview proxy [::1]:43145 -> 127.0.0.1:43145", flush=True)
    while True:
        client, _addr = server.accept()
        upstream = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            upstream.settimeout(5)
            upstream.connect(TARGET)
            upstream.settimeout(None)
        except OSError:
            try:
                client.sendall(
                    b"HTTP/1.1 502 Bad Gateway\r\n"
                    b"Content-Type: text/plain; charset=utf-8\r\n"
                    b"Connection: close\r\n"
                    b"Content-Length: 52\r\n"
                    b"\r\n"
                    b"Preview proxy: Next.js is not listening on 127.0.0.1:43145\n"
                )
            except OSError:
                pass
            client.close()
            upstream.close()
            continue
        threading.Thread(target=pipe, args=(client, upstream), daemon=True).start()


if __name__ == "__main__":
    main()
